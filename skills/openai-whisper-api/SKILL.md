---
name: openai-whisper-api
description: "Transcribe audio files via the OpenAI Whisper API (cloud). Use when a user wants fast, accurate cloud transcription or when local Whisper is not installed. Prefer this for speed over local transcription."
metadata:
  emoji: "☁️"
  tags:
    - speech-to-text
    - transcription
    - openai
    - api
  homepage: https://platform.openai.com/docs/guides/speech-to-text
---

# OpenAI Whisper API Skill

Transcribe audio files using OpenAI's cloud Whisper API.

## When to Use

- "Transcribe this audio using OpenAI"
- "Cloud transcription of this file"
- Fast, accurate transcription without local GPU

For local transcription without an API key, use the `openai-whisper` skill instead.

## Commands

### Using the Script

```bash
node {baseDir}/scripts/transcribe.mjs /path/to/audio.m4a
```

### Script Options

```bash
# Specify model
node {baseDir}/scripts/transcribe.mjs /path/to/audio.ogg --model whisper-1

# Custom output path
node {baseDir}/scripts/transcribe.mjs /path/to/audio.m4a --out /tmp/transcript.txt

# Specify language
node {baseDir}/scripts/transcribe.mjs /path/to/audio.m4a --language en

# Add context hint
node {baseDir}/scripts/transcribe.mjs /path/to/audio.m4a --prompt "Speaker names: Alice, Bob"

# JSON output
node {baseDir}/scripts/transcribe.mjs /path/to/audio.m4a --json --out /tmp/transcript.json
```

### Direct curl

```bash
curl -sS https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "file=@/path/to/audio.m4a" \
  -F "model=whisper-1" \
  -F "response_format=text"
```

## Defaults

- Model: `whisper-1`
- Output: `<input-basename>.txt` (or `.json` with `--json`)
- Format: plain text

## Notes

- Requires `OPENAI_API_KEY` (stored in credential store)
- Supports most audio formats (mp3, m4a, wav, ogg, flac, webm)
- Max file size: 25 MB
- For larger files, split with ffmpeg first
