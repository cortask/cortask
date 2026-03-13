---
name: summarize
description: "Summarize or extract text/transcripts from URLs, YouTube videos, and local files. Use when a user asks to summarize a link, get a TLDR, transcribe a YouTube video, extract content from a URL, or says 'what does this say'."
metadata:
  emoji: "\U0001F9FE"
  tags:
    - summarize
    - utility
    - youtube
---

# Summarize Skill

Extract and summarize content from web pages, YouTube videos, and local files.

## When to Use

- "What's this link about?"
- "Summarize this article"
- "Transcribe this YouTube video"
- "Extract text from this URL"

## Tool

### summarize_content

Extracts content from a source and optionally summarizes it using an LLM.

```
summarize_content(source: "https://example.com/article")
summarize_content(source: "https://youtube.com/watch?v=VIDEO_ID")
summarize_content(source: "https://example.com/article", mode: "extract")
summarize_content(source: "/path/to/file.txt", length: "short")
summarize_content(source: "https://example.com", length: "long", language: "German")
```

**Parameters:**
- `source` (required): URL or local file path
- `mode`: `"summary"` (default) or `"extract"` (raw text only, no LLM)
- `length`: `"short"` (~200 words), `"medium"` (~500 words, default), `"long"` (~1000 words)
- `language`: Language for the summary output (default: same as source)

## Supported Sources

- **Web pages**: Extracts readable content from HTML pages
- **YouTube**: Extracts video transcripts/captions
- **Local files**: Reads text files directly

## LLM Configuration

By default uses the first available provider API key. Configure a specific (e.g. cheaper/faster) model in the skill settings:

- **LLM Provider**: e.g. `gemini`, `openai`
- **LLM Model**: e.g. `gemini-2.0-flash`, `gpt-4o-mini`
