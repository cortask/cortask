#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function usage() {
  console.error(`
Usage:
  crawl.mjs <url> [--output <dir>] [--export <tabs>] [--timeout <seconds>]

Examples:
  crawl.mjs "https://example.com"
  crawl.mjs "https://example.com" --output "/tmp/sf_crawl"
  crawl.mjs "https://example.com" --export "Internal:All,Response Codes:Client Error (4xx)"
  crawl.mjs "https://example.com" --timeout 600

Default exports:
  - Internal:All
  - Response Codes:Client Error (4xx)
  - Page Titles:All
  - Meta Description:All
  - H1:All
  - Images:Missing Alt Text
  `);
  process.exit(2);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  usage();
}

const url = args[0];
let outputDir = '';
let exportTabs = 'Internal:All,Response Codes:Client Error (4xx),Page Titles:All,Meta Description:All,H1:All,Images:Missing Alt Text';
let timeoutSecs = 300;

for (let i = 1; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];

  switch (flag) {
    case '--output':
      outputDir = value;
      break;
    case '--export':
      exportTabs = value;
      break;
    case '--timeout':
      timeoutSecs = parseInt(value, 10);
      break;
    default:
      console.error(`Unknown argument: ${flag}`);
      usage();
  }
}

// Detect Screaming Frog CLI
async function detectCli() {
  return new Promise((resolve, reject) => {
    const detect = spawn('node', [join(__dirname, 'detect.mjs')]);
    let output = '';

    detect.stdout.on('data', (data) => {
      output += data.toString();
    });

    detect.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error('Screaming Frog CLI not found'));
      }
    });
  });
}

// Set default output directory
if (!outputDir) {
  outputDir = platform() === 'win32'
    ? 'C:\\Temp\\sf_crawl'
    : join(tmpdir(), 'sf_crawl');
}

console.log('Starting Screaming Frog crawl...');
console.log('URL:', url);
console.log('Output:', outputDir);
console.log('');

// Run crawl
(async () => {
  try {
    const cliPath = await detectCli();
    console.log('CLI:', cliPath);
    console.log('');

    const sfArgs = [
      '--crawl', url,
      '--headless',
      '--save-crawl',
      '--timestamped-output',
      '--output-folder', outputDir,
      '--export-tabs', exportTabs,
    ];

    const crawl = spawn(cliPath, sfArgs, {
      stdio: 'inherit',
      timeout: timeoutSecs * 1000,
    });

    crawl.on('close', (code) => {
      console.log('');
      if (code === 0) {
        console.log('Crawl complete! Output saved to:');

        // Find the timestamped directory
        if (existsSync(outputDir)) {
          const dirs = readdirSync(outputDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => join(outputDir, d.name))
            .sort()
            .reverse();

          if (dirs.length > 0) {
            const latest = dirs[0];
            console.log(latest);
            console.log('');
            console.log('CSV files:');

            const files = readdirSync(latest)
              .filter(f => f.endsWith('.csv'))
              .map(f => join(latest, f));

            files.forEach(f => console.log(f));
          }
        }
      } else {
        console.error('Crawl failed with code:', code);
        process.exit(code);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
