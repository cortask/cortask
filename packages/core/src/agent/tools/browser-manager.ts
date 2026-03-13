// agent-browser CLI manager
// Uses the agent-browser daemon for browser automation.
// The daemon persists between commands so the browser stays open.

import { execFile } from "node:child_process";
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
  try {
    const require = createRequire(import.meta.url);
    // Prefer platform-specific native binary (works inside Electron where
    // process.execPath is the Electron binary, not Node.js)
    const nativeBin = getNativeBinName();
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
let _available: boolean | null = null;

function exec(args: string[], timeout = DEFAULT_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    // Native binaries run directly; .js scripts need a Node runtime.
    // process.execPath may be Electron, so only use it as a last resort.
    const isScript = CMD.endsWith(".js");
    const cmd = isScript ? (process.env.NODE_PATH_BIN || process.execPath) : CMD;
    const finalArgs = isScript ? [CMD, ...args] : args;
    execFile(cmd, finalArgs, { timeout, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || stdout?.trim() || err.message;
        reject(new Error(msg));
      } else {
        resolve(stdout);
      }
    });
  });
}

function execJson(args: string[], timeout = DEFAULT_TIMEOUT): Promise<unknown> {
  return exec([...args, "--json"], timeout).then((out) => {
    try {
      return JSON.parse(out);
    } catch {
      return out;
    }
  });
}

export async function isAgentBrowserAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    await exec(["--version"], 5000);
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export async function ensureBrowser(): Promise<BrowserInstance> {
  if (instance) return instance;

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
      // If numeric, wait for milliseconds; otherwise wait for selector
      if (/^\d+$/.test(target)) {
        await exec(["wait", target]);
      } else if (target.startsWith("http")) {
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
