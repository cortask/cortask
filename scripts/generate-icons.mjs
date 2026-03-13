/**
 * Generates icon assets for the Electron desktop app from the SVG source.
 * Requires: pnpm add -D sharp (root devDependency)
 *
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcSvg = path.join(__dirname, "../packages/desktop/build/icon.svg");
const outDir = path.join(__dirname, "../packages/desktop/build");

// 512x512 PNG — electron-builder auto-converts to ICO/ICNS from this
await sharp(srcSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(outDir, "icon.png"));

console.log("Generated packages/desktop/build/icon.png");
console.log(
    "Run electron-builder to package — it will create icon.ico and icon.icns automatically."
);
