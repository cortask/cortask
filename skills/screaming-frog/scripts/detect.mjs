#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { platform, homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Detect Screaming Frog SEO Spider CLI location across platforms
 */
function detectScreamingFrog() {
  const os = platform();

  if (os === 'win32') {
    // Windows - check common installation paths
    const paths = [
      'C:\\Program Files (x86)\\Screaming Frog SEO Spider\\ScreamingFrogSEOSpiderCli.exe',
      'C:\\Program Files\\Screaming Frog SEO Spider\\ScreamingFrogSEOSpiderCli.exe',
      join(homedir(), 'AppData', 'Local', 'Programs', 'Screaming Frog SEO Spider', 'ScreamingFrogSEOSpiderCli.exe'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return path;
      }
    }
  } else if (os === 'darwin') {
    // macOS - check Applications folder
    const paths = [
      '/Applications/Screaming Frog SEO Spider.app/Contents/MacOS/ScreamingFrogSEOSpiderLauncher',
      join(homedir(), 'Applications', 'Screaming Frog SEO Spider.app', 'Contents', 'MacOS', 'ScreamingFrogSEOSpiderLauncher'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return path;
      }
    }
  } else {
    // Linux - check common locations
    const paths = [
      '/usr/local/bin/screamingfrogseospider',
      '/opt/ScreamingFrogSEOSpider/screamingfrogseospider',
      join(homedir(), '.local', 'bin', 'screamingfrogseospider'),
    ];

    for (const path of paths) {
      if (existsSync(path)) {
        return path;
      }
    }

    // Also check if in PATH
    return 'screamingfrogseospider';
  }

  return null;
}

// Run detection
const cliPath = detectScreamingFrog();

if (cliPath) {
  console.log(cliPath);
  process.exit(0);
} else {
  console.error('Screaming Frog SEO Spider CLI not found');
  console.error('Please install from: https://www.screamingfrog.co.uk/seo-spider/');
  process.exit(1);
}
