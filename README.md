<p align="center">
  <img src="packages/desktop/build/icon.png" alt="Cortask" width="120" />
</p>

<h1 align="center">Cortask</h1>

<p align="center">
  Local AI agent with skills, workspaces, and cron — run it anywhere.
</p>

<p align="center">
  <a href="https://github.com/cortask/cortask/releases"><img src="https://img.shields.io/github/v/release/cortask/cortask?style=flat-square" alt="Release" /></a>
  <a href="https://www.npmjs.com/package/cortask"><img src="https://img.shields.io/npm/v/cortask?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/cortask/cortask/pkgs/container/cortask"><img src="https://img.shields.io/badge/ghcr.io-cortask-blue?style=flat-square" alt="Docker" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/cortask/cortask?style=flat-square" alt="License" /></a>
</p>

---

Cortask is a self-hosted AI orchestration platform. It connects to multiple LLM providers, extends functionality through a skill system, and runs as a web app, desktop app, CLI, or Docker container. All data stays on your machine.

## Features

- **Multi-provider** — Anthropic, OpenAI, Google Gemini, Grok, Ollama, OpenRouter, and any OpenAI-compatible endpoint
- **Skills** — Drop-in plugins (SKILL.md files) for tools like GitHub, Notion, Google Workspace, Slack, email, and more
- **Workspaces** — Isolated projects with separate memory, sessions, and configuration
- **Channels** — Connect to Telegram, Discord, and WhatsApp as a bot
- **Cron** — Schedule recurring agent tasks
- **Cost tracking** — Monitor token usage and set spending limits per workspace
- **Encrypted credentials** — API keys stored with AES-256-GCM, never in plain config
- **Built-in tools** — File I/O, bash, web fetch, web search, persistent memory, subagents

## Install

### Desktop App

Download the latest release for your platform:

| Platform | Format |
|----------|--------|
| Windows  | [.exe](https://github.com/cortask/cortask/releases/latest) |
| macOS    | [.dmg](https://github.com/cortask/cortask/releases/latest) |
| Linux    | [.AppImage](https://github.com/cortask/cortask/releases/latest) / [.deb](https://github.com/cortask/cortask/releases/latest) / [.rpm](https://github.com/cortask/cortask/releases/latest) |

### npm

```bash
npx cortask serve
```

Or install globally:

```bash
npm install -g cortask
cortask serve
```

### Docker

```bash
docker run -d -p 3777:3777 -v cortask-data:/data ghcr.io/cortask/cortask:latest
```

Or with Docker Compose:

```bash
curl -O https://raw.githubusercontent.com/cortask/cortask/main/docker-compose.yml
docker compose up -d
```

### Script (Mac / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/cortask/cortask/main/scripts/install.sh | bash
```

### Script (Windows PowerShell)

```powershell
irm https://raw.githubusercontent.com/cortask/cortask/main/scripts/install.ps1 | iex
```

Then open [http://localhost:3777](http://localhost:3777).

## Skills

Skills are markdown files that teach the agent new capabilities. Cortask ships with 25+ built-in skills:

| Category | Skills |
|----------|--------|
| Productivity | Notion, Trello, Slack, Google Workspace, Email |
| Notes | Apple Notes, Bear, Obsidian, Apple Reminders, Things |
| AI / Media | OpenAI Image Gen, Whisper (transcription), ElevenLabs TTS |
| Development | GitHub, Web Browsing, Screaming Frog, WordPress |
| Data | DataForSEO, Google Search Console |

Install community skills from git:

```bash
cortask skills install https://github.com/user/cortask-skill-name.git
```

Or create your own — a skill is just a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: "Does something useful."
---

# My Skill

Instructions for the agent...
```

## CLI

```
cortask serve                  Start the web server (default: port 3777)
cortask chat                   Interactive terminal chat
cortask run "prompt"           Run a single prompt
cortask setup                  Initial configuration
cortask status                 Check system status
cortask workspaces list        List workspaces
cortask credentials set        Store an API key
cortask skills list            List installed skills
cortask cron add               Schedule a recurring task
```

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   @cortask   │   │   @cortask   │   │   @cortask   │
│      ui      │   │   channels   │   │   desktop    │
│  (React 19)  │   │ (TG/DC/WA)  │   │  (Electron)  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └────────┬─────────┘                  │
                │                            │
       ┌────────▼─────────┐                  │
       │    @cortask      │◄─────────────────┘
       │    gateway       │
       │ (Express + WS)   │
       └────────┬─────────┘
                │
       ┌────────▼─────────┐
       │    @cortask      │
       │      core        │
       │  (Agent runner,  │
       │   providers,     │
       │   skills, cron)  │
       └──────────────────┘
```

| Package | Description |
|---------|-------------|
| `@cortask/core` | Agent runner, LLM providers, skills, credentials, cron, sessions |
| `@cortask/gateway` | Express REST API + WebSocket server, serves the UI |
| `@cortask/ui` | React web interface |
| `@cortask/channels` | Telegram, Discord, WhatsApp integrations |
| `@cortask/desktop` | Electron desktop app with auto-updates |
| `cortask` | CLI (`cortask serve`, `cortask chat`, etc.) |

## Development

```bash
git clone https://github.com/cortask/cortask.git
cd cortask
pnpm install
pnpm run dev
```

Requires Node.js >= 20 and pnpm.

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Build dependencies, then run gateway + UI |
| `pnpm run build` | Build all packages |
| `pnpm run test` | Run tests |
| `pnpm run typecheck` | Type check all packages |
| `pnpm run lint` | Lint all packages |

## License

[MIT](LICENSE)
