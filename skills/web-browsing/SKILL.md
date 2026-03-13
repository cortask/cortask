---
name: web-browsing
description: "Search the web, fetch URLs, and browse pages. Use when a user asks to look something up, read a webpage, search online, or interact with a website."
always: true
metadata:
    emoji: "🌐"
---

# Web Browsing

You have three web tools available. Use the simplest tool that works for the task.

## Tool Selection

1. **cortask_web_search** — Find information on the web. Use this first when you need to look something up. Requires a Brave Search API key.
2. **cortask_web_fetch** — Fetch a URL and get readable content as markdown. Use for reading articles, docs, or API responses. Always available.
3. **cortask_browser** — Full headless browser (Playwright). Use only when you need JavaScript rendering, screenshots, form interaction, or multi-step navigation. Requires Playwright to be installed.

## Preferred Workflow

- **Research:** `web_search` → pick best URL → `web_fetch` to read it
- **Read a known URL:** `web_fetch` directly
- **Interactive / JS-heavy pages:** `web_browser` with `navigate`, then `get_content` or `screenshot`
- **Fill a form:** `browser navigate` → `browser type` → `browser click`

## Tips

- `web_fetch` is faster and lighter than the browser — prefer it for static content
- The browser keeps a single page open; `navigate` replaces it
- Use `screenshot` to visually verify page state when unsure
- Use `evaluate` sparingly — prefer `click`/`type` actions over raw JS
- Content is truncated to 50K chars; use `get_content` after navigation if you need updated page text
