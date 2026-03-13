#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

function usage() {
  console.error(`
Usage:
  tts.mjs <text> [--voice <voice-id>] [--model <model-id>] [--out /path/to/output.mp3]

Examples:
  tts.mjs "Hello world"
  tts.mjs "Hello from Rachel" --voice 21m00Tcm4TlvDq8ikWAM
  tts.mjs "Testing" --model eleven_multilingual_v2 --out ~/speech.mp3
  `);
  process.exit(2);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  usage();
}

const text = args[0];
let voice = '21m00Tcm4TlvDq8ikWAM'; // Rachel
let model = 'eleven_turbo_v2_5';
let output = '';

for (let i = 1; i < args.length; i += 2) {
  const flag = args[i];
  const value = args[i + 1];

  switch (flag) {
    case '--voice':
      voice = value;
      break;
    case '--model':
      model = value;
      break;
    case '--out':
      output = value;
      break;
    default:
      console.error(`Unknown argument: ${flag}`);
      usage();
  }
}

const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY environment variable');
  process.exit(1);
}

if (!output) {
  output = `speech_${Date.now()}.mp3`;
}

// Make API request
const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: text,
    model_id: model,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
    },
  }),
});

if (!response.ok) {
  const error = await response.text();
  console.error('API Error:', error);
  process.exit(1);
}

const buffer = await response.arrayBuffer();
await writeFile(output, Buffer.from(buffer));

console.log(output);
