import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    format: ["cjs"],
    platform: "node",
    target: "node20",
    clean: true,
    sourcemap: true,
    external: [
      "electron",
      // Native modules must stay external
      "better-sqlite3",
      "electron-updater",
      "agent-browser",
      "node-llama-cpp",
      "playwright",
      "playwright-core",
      /^chromium-bidi/,
      /\.node$/,
      // Exclude channels due to grammy platform-specific code
      "@cortask/channels",
    ],
    // Bundle workspace packages
    noExternal: [
      "@cortask/core",
      "@cortask/gateway",
    ],
    banner: {
      // Shim import.meta.url for ESM code transpiled to CJS
      js: `if(typeof globalThis.__importMetaUrl==="undefined"){globalThis.__importMetaUrl=require("url").pathToFileURL(__filename).toString();}`,
    },
    define: {
      "import.meta.url": "globalThis.__importMetaUrl",
    },
  },
  {
    entry: { preload: "src/preload.ts" },
    format: ["cjs"],
    outExtension: () => ({ js: ".js" }),
    sourcemap: true,
    target: "node20",
    external: ["electron"],
  },
]);
