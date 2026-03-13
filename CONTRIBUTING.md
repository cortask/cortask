# Contributing to Cortask

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/cortask/cortask.git
cd cortask
pnpm install
pnpm run dev
```

Requires Node.js >= 20 and pnpm.

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run checks:
   ```bash
   pnpm run typecheck
   pnpm run test
   pnpm run lint
   ```
4. Open a pull request

## Code Style

- TypeScript strict mode, ESM modules
- Keep files small — one concern per file
- Use Zod for runtime validation
- No unnecessary abstractions — simple and direct

## Project Structure

| Package | What it does |
|---------|-------------|
| `packages/core` | Agent runner, providers, skills, credentials |
| `packages/gateway` | Express API + WebSocket server |
| `packages/ui` | React web interface |
| `packages/channels` | Telegram, Discord, WhatsApp |
| `packages/desktop` | Electron app |
| `packages/cli` | CLI tool |
| `skills/` | Built-in skill plugins |

Build order matters: `core` → `channels` → everything else.

## Creating Skills

Skills are the easiest way to contribute. A skill is a `SKILL.md` file:

```markdown
---
name: my-skill
description: "What it does"
metadata:
  emoji: "🔧"
  tags: [category]
---

Instructions for the agent...
```

See `skills/example/SKILL.md` for a full template.

## Reporting Bugs

Use [GitHub Issues](https://github.com/cortask/cortask/issues/new/choose) with the bug report template.

## Security Issues

Do **not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).
