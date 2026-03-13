---
name: openai-image-gen
description: "Generate images via the OpenAI Images API (GPT Image, DALL-E 3/2). Use when a user asks to create images with DALL-E or OpenAI, generate AI art, or batch-generate multiple images. Do NOT use for Gemini image requests."
requires:
  bins:
    - python3
install:
  - kind: brew
    formula: python
    bins: [python3]
    os: [darwin, linux]
    label: "Install Python (brew)"
  - kind: winget
    package: Python.Python.3.12
    bins: [python3]
    os: [win32]
    label: "Install Python (winget)"
metadata:
  emoji: "🖼️"
  tags:
    - image-generation
    - openai
    - dall-e
    - ai
  homepage: https://platform.openai.com/docs/api-reference/images
---

# OpenAI Image Generation Skill

Generate images via the OpenAI Images API using a bundled Python script.

## When to Use

- "Generate an image of..."
- "Create a picture of..."
- "Make me some AI art"
- "Batch generate images"

## Commands

### Basic Generation

```bash
python3 {baseDir}/scripts/gen.py --prompt "ultra-detailed studio photo of a lobster astronaut"
```

### Batch Generation

```bash
# Generate 4 images
python3 {baseDir}/scripts/gen.py --prompt "cyberpunk noodle shop" --count 4

# Random prompts (no --prompt flag)
python3 {baseDir}/scripts/gen.py --count 8
```

### Model Selection

```bash
# GPT Image (default, best quality)
python3 {baseDir}/scripts/gen.py --model gpt-image-1

# GPT Image 1.5
python3 {baseDir}/scripts/gen.py --model gpt-image-1.5

# DALL-E 3 (limited to 1 image at a time)
python3 {baseDir}/scripts/gen.py --model dall-e-3 --quality hd --style vivid

# DALL-E 2 (faster, lower quality)
python3 {baseDir}/scripts/gen.py --model dall-e-2 --size 512x512 --count 4
```

### Options

```bash
# Size
python3 {baseDir}/scripts/gen.py --size 1536x1024  # landscape
python3 {baseDir}/scripts/gen.py --size 1024x1536  # portrait

# Quality
python3 {baseDir}/scripts/gen.py --quality high     # GPT models
python3 {baseDir}/scripts/gen.py --quality hd        # DALL-E 3

# GPT model extras
python3 {baseDir}/scripts/gen.py --background transparent --output-format webp

# DALL-E 3 style
python3 {baseDir}/scripts/gen.py --model dall-e-3 --style natural

# Custom output directory
python3 {baseDir}/scripts/gen.py --out-dir ./my-images
```

## Model-Specific Parameters

### Size

| Model | Sizes |
|-------|-------|
| GPT Image | `1024x1024`, `1536x1024`, `1024x1536`, `auto` |
| DALL-E 3 | `1024x1024`, `1792x1024`, `1024x1792` |
| DALL-E 2 | `256x256`, `512x512`, `1024x1024` |

### Quality

| Model | Options | Default |
|-------|---------|---------|
| GPT Image | `auto`, `high`, `medium`, `low` | `high` |
| DALL-E 3 | `hd`, `standard` | `standard` |
| DALL-E 2 | `standard` only | `standard` |

## Output

- Image files (PNG/JPEG/WebP)
- `prompts.json` — Prompt-to-file mapping
- `index.html` — Thumbnail gallery (open in browser)

## Notes

- Requires `OPENAI_API_KEY` (stored in credential store)
- DALL-E 3 only generates 1 image per request (count is auto-limited)
- GPT Image models support transparent backgrounds and WebP output
- No external Python packages needed (uses only stdlib)
