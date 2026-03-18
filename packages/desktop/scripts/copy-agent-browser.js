// Copies the agent-browser binary for the current platform into build/agent-browser-bin/
// so electron-builder can include it in extraResources.
const fs = require("fs");
const path = require("path");

const binNames = {
  "win32-x64": "agent-browser-win32-x64.exe",
  "darwin-arm64": "agent-browser-darwin-arm64",
  "darwin-x64": "agent-browser-darwin-x64",
  "linux-arm64": "agent-browser-linux-arm64",
  "linux-x64": "agent-browser-linux-x64",
};

const key = `${process.platform}-${process.arch}`;
const binName = binNames[key];
if (!binName) {
  console.warn(`No agent-browser binary for ${key}, skipping`);
  process.exit(0);
}

// Resolve the binary from the agent-browser package
let srcDir;
try {
  const agentBrowserPkg = require.resolve("agent-browser/package.json", {
    paths: [path.resolve(__dirname, "../../core")],
  });
  srcDir = path.join(path.dirname(agentBrowserPkg), "bin");
} catch {
  console.warn("agent-browser package not found, skipping");
  process.exit(0);
}

const src = path.join(srcDir, binName);
if (!fs.existsSync(src)) {
  console.warn(`Binary not found: ${src}, skipping`);
  process.exit(0);
}

const outDir = path.join(__dirname, "..", "build", "agent-browser-bin");
fs.mkdirSync(outDir, { recursive: true });

const dest = path.join(outDir, binName);
fs.copyFileSync(src, dest);
// Preserve executable permission
if (process.platform !== "win32") {
  fs.chmodSync(dest, 0o755);
}

console.log(`Copied ${binName} → build/agent-browser-bin/`);
