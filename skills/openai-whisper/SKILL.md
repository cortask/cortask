---
name: openai-whisper
description: "Local speech-to-text transcription with the Whisper CLI. No API key needed. Use when a user wants to transcribe audio locally or offline, generate subtitles, or convert speech to text without cloud services. Prefer this for privacy-sensitive audio or when no API key is available."
requires:
  bins:
    - whisper
    - ffmpeg
install:
  - kind: brew
    formula: openai-whisper
    bins: [whisper]
    os: [darwin, linux]
    label: "Install OpenAI Whisper (brew)"
  - kind: uv
    package: openai-whisper
    bins: [whisper]
    os: [win32]
    label: "Install OpenAI Whisper (uv/pip)"
  - kind: winget
    package: Gyan.FFmpeg
    bins: [ffmpeg]
    os: [win32]
    label: "Install FFmpeg (winget)"
  - kind: brew
    formula: ffmpeg
    bins: [ffmpeg]
    os: [darwin, linux]
    label: "Install FFmpeg (brew)"
metadata:
  emoji: "🎙️"
  tags:
    - speech-to-text
    - transcription
    - audio
    - ai
  homepage: https://openai.com/research/whisper
---

# Whisper (Local) Skill

Use `whisper` to transcribe audio files locally. No API key required — runs entirely on your machine.

## When to Use

- "Transcribe this audio file"
- "Convert speech to text"
- "Generate subtitles for this audio"

## Commands

### Basic Transcription

```bash
# Transcribe to text file
whisper /path/to/audio.mp3 --model medium --output_format txt --output_dir .

# Transcribe to SRT subtitles
whisper /path/to/audio.m4a --output_format srt --output_dir .

# Translate to English
whisper /path/to/audio.mp3 --task translate --output_format txt
```

### Model Selection

- `--model tiny` — Fastest, least accurate
- `--model base` — Fast, basic accuracy
- `--model small` — Good balance
- `--model medium` — Better accuracy
- `--model large` — Best accuracy, slowest
- `--model turbo` — Default, optimized for speed

### Output Formats

- `txt` — Plain text
- `srt` — SubRip subtitles
- `vtt` — WebVTT subtitles
- `json` — Detailed JSON with timestamps

## Notes

- Models download to `~/.cache/whisper` on first use
- Use smaller models for speed, larger for accuracy
- Supports most audio formats (mp3, m4a, wav, flac, etc.)
- No API key or internet connection needed after model download
- GPU acceleration available if CUDA/Metal is configured
