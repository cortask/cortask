#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { existsSync } from 'node:fs';
import FormData from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';

function usage() {
  console.error(`
Usage:
  transcribe.mjs <audio-file> [--model whisper-1] [--out /path/to/out.txt] [--language en] [--prompt "hint"] [--json]

Examples:
  transcribe.mjs audio.mp3
  transcribe.mjs audio.m4a --model whisper-1 --language en
  transcribe.mjs audio.ogg --json --out transcript.json
  `);
  process.exit(2);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  usage();
}

const inputFile = args[0];
let model = 'whisper-1';
let outputFile = '';
let language = '';
let prompt = '';
let responseFormat = 'text';

for (let i = 1; i < args.length; i++) {
  const flag = args[i];

  switch (flag) {
    case '--model':
      model = args[++i];
      break;
    case '--out':
      outputFile = args[++i];
      break;
    case '--language':
      language = args[++i];
      break;
    case '--prompt':
      prompt = args[++i];
      break;
    case '--json':
      responseFormat = 'json';
      break;
    default:
      console.error(`Unknown argument: ${flag}`);
      usage();
  }
}

if (!existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Set default output file
if (!outputFile) {
  const base = basename(inputFile, extname(inputFile));
  outputFile = responseFormat === 'json' ? `${base}.json` : `${base}.txt`;
}

// Ensure output directory exists
const outDir = dirname(outputFile);
if (outDir && outDir !== '.' && !existsSync(outDir)) {
  await mkdir(outDir, { recursive: true });
}

// Create form data
const form = new FormData();
form.set('file', await fileFromPath(inputFile));
form.set('model', model);
form.set('response_format', responseFormat);

if (language) {
  form.set('language', language);
}

if (prompt) {
  form.set('prompt', prompt);
}

// Make API request
const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  },
  body: form,
});

if (!response.ok) {
  const error = await response.text();
  console.error('API Error:', error);
  process.exit(1);
}

const result = responseFormat === 'json'
  ? JSON.stringify(await response.json(), null, 2)
  : await response.text();

await writeFile(outputFile, result);

console.log(outputFile);
