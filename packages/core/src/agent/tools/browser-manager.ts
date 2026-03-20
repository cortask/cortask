// agent-browser CLI manager
// Uses the agent-browser daemon for browser automation.
// The daemon persists between commands so the browser stays open.

import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const DEFAULT_TIMEOUT = 30_000;

function getNativeBinName(): string | null {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "win32" && arch === "x64") return "agent-browser-win32-x64.exe";
  if (platform === "darwin" && arch === "arm64") return "agent-browser-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "agent-browser-darwin-x64";
  if (platform === "linux" && arch === "arm64") return "agent-browser-linux-arm64";
  if (platform === "linux" && arch === "x64") return "agent-browser-linux-x64";
  return null;
}

function resolveCmd(): string {
  const nativeBin = getNativeBinName();

  // Check Electron extraResources (packaged desktop app)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resourcesPath = (process as any).resourcesPath as string | undefined;
  if (resourcesPath && nativeBin) {
    const candidate = join(resourcesPath, "agent-browser", nativeBin);
    if (existsSync(candidate)) return candidate;
  }

  try {
    const require = createRequire(import.meta.url);
    if (nativeBin) {
      try {
        return require.resolve(`agent-browser/bin/${nativeBin}`);
      } catch {
        // fall through to .js wrapper
      }
    }
    return require.resolve("agent-browser/bin/agent-browser.js");
  } catch {
    return "agent-browser";
  }
}

const CMD = resolveCmd();

export interface BrowserInstance {
  run(args: string[]): Promise<string>;
  navigate(url: string): Promise<{ title: string; url: string; content: string }>;
  snapshot(interactive?: boolean): Promise<string>;
  screenshot(): Promise<Buffer>;
  click(selector: string): Promise<void>;
  fill(selector: string, text: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  evaluate(script: string): Promise<string>;
  getContent(): Promise<{ title: string; url: string; content: string }>;
  select(selector: string, value: string): Promise<void>;
  press(key: string): Promise<void>;
  wait(target: string): Promise<void>;
  close(): Promise<void>;
}

let instance: BrowserInstance | null = null;

function ensureAgentBrowserHome(): string {
  if (!process.env.AGENT_BROWSER_HOME) {
    const dir = join(homedir(), ".agent-browser");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Set globally so daemon subprocesses inherit it
    process.env.AGENT_BROWSER_HOME = dir;
  }
  return process.env.AGENT_BROWSER_HOME;
}

// Set AGENT_BROWSER_HOME early so it's in process.env for all child processes
ensureAgentBrowserHome();

function exec(args: string[], timeout = DEFAULT_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    const isScript = CMD.endsWith(".js");
    const cmd = isScript ? (process.env.NODE_PATH_BIN || process.execPath) : CMD;
    const finalArgs = isScript ? [CMD, ...args] : args;
    // Explicitly pass env to ensure AGENT_BROWSER_HOME and clean ELECTRON vars
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    execFile(cmd, finalArgs, { timeout, maxBuffer: 5 * 1024 * 1024, env }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || stdout?.trim() || err.message;
        reject(new Error(msg));
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function isAgentBrowserAvailable(): Promise<boolean> {
  try {
    await exec(["--version"], 5000);
    return true;
  } catch {
    return false;
  }
}

let _installed = false;

export async function ensureInstalled(): Promise<void> {
  if (_installed) return;
  try {
    await exec(["--version"], 5000);
  } catch {
    throw new Error("agent-browser is not installed. Run: npm install -g agent-browser");
  }
  // Run install to download Chromium if not already present
  try {
    await exec(["install"], 120_000);
  } catch {
    // install may fail if browsers already exist — that's fine
  }
  _installed = true;
}

export async function ensureBrowser(): Promise<BrowserInstance> {
  if (instance) return instance;
  await ensureInstalled();

  // Kill any stale daemon left over from a previous session
  await exec(["close"], 5000).catch(() => {});

  const inst: BrowserInstance = {
    async run(args: string[]) {
      return exec(args);
    },

    async navigate(url: string) {
      await exec(["open", url, "--headed"]);
      await exec(["wait", "--load", "domcontentloaded"]);
      const titleOut = await exec(["get", "title"]);
      const urlOut = await exec(["get", "url"]);
      const content = await exec(["snapshot", "-i", "-c"]);
      return {
        title: titleOut.trim(),
        url: urlOut.trim(),
        content,
      };
    },

    async snapshot(interactive = true) {
      const args = ["snapshot"];
      if (interactive) args.push("-i");
      args.push("-c");
      return exec(args);
    },

    async screenshot() {
      const tmpPath = `${process.env.TEMP || "/tmp"}/ab-screenshot-${Date.now()}.png`;
      await exec(["screenshot", tmpPath]);
      const fs = await import("node:fs/promises");
      const buf = await fs.readFile(tmpPath);
      await fs.unlink(tmpPath).catch(() => {});
      return buf;
    },

    async click(selector: string) {
      await exec(["click", selector]);
    },

    async fill(selector: string, text: string) {
      await exec(["fill", selector, text]);
    },

    async type(selector: string, text: string) {
      await exec(["type", selector, text]);
    },

    async evaluate(script: string) {
      return exec(["eval", script]);
    },

    async getContent() {
      const titleOut = await exec(["get", "title"]);
      const urlOut = await exec(["get", "url"]);
      const content = await exec(["snapshot", "-i", "-c"]);
      return {
        title: titleOut.trim(),
        url: urlOut.trim(),
        content,
      };
    },

    async select(selector: string, value: string) {
      await exec(["select", selector, value]);
    },

    async press(key: string) {
      await exec(["press", key]);
    },

    async wait(target: string) {
      if (target.startsWith("http")) {
        await exec(["wait", "--url", target]);
      } else {
        await exec(["wait", target]);
      }
    },

    async close() {
      await exec(["close"]).catch(() => {});
      instance = null;
    },
  };

  instance = inst;
  return inst;
}

export async function closeBrowser(): Promise<void> {
  if (instance) {
    await instance.close();
  }
}
