---
name: sherpa-onnx-tts
description: "Local offline text-to-speech via sherpa-onnx. No cloud, no API key. Use when a user wants TTS locally or offline. Prefer this when no ElevenLabs API key is available or for privacy-sensitive content."
os:
  - darwin
  - linux
  - win32
requires:
  env:
    - SHERPA_ONNX_RUNTIME_DIR
    - SHERPA_ONNX_MODEL_DIR
install:
  - id: download-runtime-macos
    kind: download
    os: [darwin]
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-osx-universal2-shared.tar.bz2"
    archive: tar.bz2
    extract: true
    stripComponents: 1
    targetDir: runtime
    label: "Download sherpa-onnx runtime (macOS)"
  - id: download-runtime-linux-x64
    kind: download
    os: [linux]
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-linux-x64-shared.tar.bz2"
    archive: tar.bz2
    extract: true
    stripComponents: 1
    targetDir: runtime
    label: "Download sherpa-onnx runtime (Linux x64)"
  - id: download-runtime-win-x64
    kind: download
    os: [win32]
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-win-x64-shared.tar.bz2"
    archive: tar.bz2
    extract: true
    stripComponents: 1
    targetDir: runtime
    label: "Download sherpa-onnx runtime (Windows x64)"
  - id: download-model-lessac
    kind: download
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-high.tar.bz2"
    archive: tar.bz2
    extract: true
    targetDir: models
    label: "Download Piper en_US lessac voice (high)"
metadata:
  emoji: "🗣️"
  tags:
    - tts
    - speech
    - audio
    - local
    - offline
  homepage: https://github.com/k2-fsa/sherpa-onnx
---

# Local TTS Skill (sherpa-onnx)

Offline text-to-speech using the sherpa-onnx runtime. No cloud, no API key required.

## When to Use

- "Generate speech locally"
- "Text to speech without an API"
- "Offline TTS"

## Setup

1. Download the runtime for your OS (via the install options above)
2. Download a voice model (e.g., Piper en_US lessac)
3. Set environment variables pointing to the installed directories:

```bash
export SHERPA_ONNX_RUNTIME_DIR="/path/to/sherpa-onnx-tts/runtime"
export SHERPA_ONNX_MODEL_DIR="/path/to/sherpa-onnx-tts/models/vits-piper-en_US-lessac-high"
```

## Commands

### Generate Speech

```bash
node {baseDir}/bin/sherpa-onnx-tts -o ./output.wav "Hello from local TTS."
```

### With Custom Options

```bash
# Specify model file explicitly
node {baseDir}/bin/sherpa-onnx-tts --model-file /path/to/model.onnx -o speech.wav "Your text here"

# Specify tokens and data directories
node {baseDir}/bin/sherpa-onnx-tts --tokens-file /path/to/tokens.txt --data-dir /path/to/espeak-ng-data -o speech.wav "Your text"
```

### Windows

```bash
node {baseDir}\bin\sherpa-onnx-tts -o tts.wav "Hello from local TTS."
```

## Notes

- Completely offline — no internet needed after initial download
- Cross-platform: macOS, Linux, Windows
- Output format: WAV
- Pick different models from the sherpa-onnx `tts-models` release for other voices/languages
- If the model directory has multiple `.onnx` files, set `SHERPA_ONNX_MODEL_FILE` or pass `--model-file`
