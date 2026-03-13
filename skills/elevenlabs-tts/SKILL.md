---
name: elevenlabs-tts
description: "ElevenLabs cloud text-to-speech for high-quality voice audio. Use when a user wants to generate speech, read text aloud, or create audio narration. Prefer this for high-quality voices. For offline/local TTS without an API key, use sherpa-onnx-tts instead."
metadata:
  emoji: "🗣️"
  tags:
    - tts
    - speech
    - audio
    - elevenlabs
    - api
  homepage: https://elevenlabs.io/docs/api-reference/text-to-speech
---

# ElevenLabs TTS Skill

Generate high-quality text-to-speech audio using the ElevenLabs API.

## When to Use

- "Say this out loud"
- "Read this text to me"
- "Generate an audio file of this"
- "Create a voice recording"

## Commands

### Using the Script

```bash
node {baseDir}/scripts/tts.mjs "Hello there"
```

### Script Options

```bash
# Specify voice ID
node {baseDir}/scripts/tts.mjs "Hello from Rachel" --voice 21m00Tcm4TlvDq8ikWAM

# Specify model
node {baseDir}/scripts/tts.mjs "Testing eleven turbo v2.5" --model eleven_turbo_v2_5

# Custom output path
node {baseDir}/scripts/tts.mjs "Save this audio" --out /tmp/speech.mp3

# Combine options
node {baseDir}/scripts/tts.mjs "Custom voice and path" --voice EXAVITQu4vr4xnSDxMaL --out ~/audio.mp3
```

### Direct curl

```bash
curl -sS "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello there",
    "model_id": "eleven_turbo_v2_5"
  }' \
  --output speech.mp3
```

## Available Models

- `eleven_turbo_v2_5` — Fastest, lowest latency (default)
- `eleven_multilingual_v2` — Stable, multilingual
- `eleven_monolingual_v1` — English only, high quality

## Popular Voice IDs

- `21m00Tcm4TlvDq8ikWAM` — Rachel (default)
- `EXAVITQu4vr4xnSDxMaL` — Bella
- `AZnzlk1XvdvUeBnXmlld` — Domi
- `ErXwobaYiN019PkySvjV` — Antoni
- `VR6AewLTigWG4xSOukaG` — Arnold

## Voice Settings

Default settings (adjustable in script):
- Stability: 0.5
- Similarity boost: 0.75
- Style: 0
- Use speaker boost: true

## Notes

- Requires `ELEVENLABS_API_KEY` (stored in credential store)
- Output format: MP3 (MPEG Audio Layer 3)
- Default voice: Rachel
- For voice list, visit: https://elevenlabs.io/voice-library
