---
name: nano-banana-pro
description: "Generate or edit images via Gemini 3 Pro Image. Use when a user asks to create an image with Gemini, edit a photo, or combine multiple images. Supports generation, editing, and multi-image composition. Do NOT use for OpenAI/DALL-E image requests."
requires:
  bins:
    - uv
install:
  - kind: brew
    formula: uv
    bins: [uv]
    os: [darwin, linux]
    label: "Install uv (brew)"
metadata:
  emoji: "🍌"
  tags:
    - image-generation
    - gemini
    - google
    - ai
  homepage: https://ai.google.dev/
---

# Gemini Image Generation Skill

Generate or edit images using Google's Gemini 3 Pro Image model via a bundled Python script.

## When to Use

- "Generate an image with Gemini"
- "Edit this image"
- "Combine these images into one scene"

## Commands

### Generate an Image

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "your image description" --filename "output.png"
```

### Edit a Single Image

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "edit instructions" --filename "output.png" -i "/path/to/input.png"
```

### Multi-Image Composition (up to 14 images)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "combine these into one scene" --filename "output.png" -i img1.png -i img2.png -i img3.png
```

### Resolution Options

```bash
# Default 1K
uv run {baseDir}/scripts/generate_image.py --prompt "..." --filename "out.png" --resolution 1K

# Higher resolution
uv run {baseDir}/scripts/generate_image.py --prompt "..." --filename "out.png" --resolution 2K
uv run {baseDir}/scripts/generate_image.py --prompt "..." --filename "out.png" --resolution 4K
```

Resolution auto-detects from input image dimensions when editing.

## Notes

- Requires `GEMINI_API_KEY` (stored in credential store)
- Requires `uv` (Python package runner) — handles dependencies automatically
- Resolutions: `1K` (default), `2K`, `4K`
- Use timestamps in filenames: `2026-02-26-sunset.png`
- The script prints the saved file path — do not read the image back, just report the path
- Dependencies (`google-genai`, `pillow`) are installed automatically by `uv`
