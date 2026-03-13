// Rebuild native modules (better-sqlite3) for Electron's Node ABI.
// Usage: node scripts/rebuild-native.js

const path = require("path");
const { execSync } = require("child_process");

const bsqlDir = path.dirname(require.resolve("better-sqlite3/package.json"));
const electronPkg = require("electron/package.json");
const electronVersion = electronPkg.version;

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion}...`);
console.log(`Module path: ${bsqlDir}`);

execSync(`npx prebuild-install -r electron -t ${electronVersion}`, {
  cwd: bsqlDir,
  stdio: "inherit",
});

console.log("Done.");
