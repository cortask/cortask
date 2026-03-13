# Cortask

Multi-agent AI orchestration platform with web UI, gateway API, CLI, desktop app, and extensible skill system.

## Stack

- **TypeScript** (strict), **Node.js >= 20**, **ESM** (`"type": "module"`)
- **Monorepo:** pnpm workspaces
- **Packages:** `@cortask/core`, `@cortask/gateway`, `@cortask/ui`, `@cortask/cli`, `@cortask/channels`, `@cortask/desktop`
- **UI:** React 19, Vite, React Router 7, Zustand, TailwindCSS, Radix UI
- **Backend:** Express + WebSocket (port 3777)
- **Database:** better-sqlite3
- **Build:** tsup (packages), Vite (UI)
- **Test:** Vitest

## Commands

```bash
pnpm run dev            # Build deps, then run gateway + UI concurrently
pnpm run build          # Build all packages (order matters: core → channels → rest)
pnpm run build:deps     # Build core + channels only
pnpm run test           # Run tests across all packages
pnpm run typecheck      # Type check all packages
pnpm run lint           # Lint all packages
```

## Architecture

- **Providers:** Multi-LLM abstraction (`LLMProvider` interface) — Anthropic, OpenAI, Google Gemini
- **Skills:** SKILL.md files with YAML frontmatter + markdown instructions. Three tiers: text-only, HTTP templates, code-based. Located in `/skills/`
- **Credentials:** Encrypted `CredentialStore` (AES-256-GCM). All secrets in credential store, not in config files
- **Agent runner:** Tool concurrency limit of 5, tool result truncation at 1500 chars
- **Gateway:** Express + WebSocket, serves UI as static files. REST at `/api`, WebSocket at `/ws`

## Code Style

- Keep files small and modular — one concern per file
- Use Zod schemas for runtime validation
- UI uses `@/` path alias pointing to `src/`
- No documentation files unless explicitly requested
- Reference codebases in `_references/` — check them before building new features. Contains `accomplish` repo as implementation reference for equivalent features

## Important Paths

- `packages/core/src/` — Agent runner, providers, config, workspace, skills, cron, session
- `packages/gateway/src/` — Express API + WebSocket server
- `packages/ui/src/` — React web app (pages, components, stores)
- `packages/channels/src/` — Channel integrations (Telegram, Discord)
- `skills/` — Skill plugin directory
