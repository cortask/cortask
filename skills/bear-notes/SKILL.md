---
name: bear-notes
description: "Create, search, and manage Bear notes via the grizzly CLI on macOS. Use when a user explicitly mentions Bear or Bear notes. Do NOT use for Apple Notes or Obsidian."
compatibility:
  os:
    - darwin
requires:
  bins:
    - grizzly
install:
  - kind: go
    module: github.com/tylerwince/grizzly/cmd/grizzly@latest
    bins: [grizzly]
    label: "Install grizzly (go)"
metadata:
  emoji: "🐻"
  tags:
    - notes
    - bear
    - productivity
    - macos
  homepage: https://bear.app
---

# Bear Notes Skill

Use `grizzly` to create, read, and manage notes in Bear on macOS.

## When to Use

- "Create a note in Bear"
- "Search my Bear notes"
- "Add text to a Bear note"
- "List my Bear tags"

## Setup

- Bear app must be installed and running
- For some operations (add-text, tags, open-note --selected), a Bear API token is needed:
  1. Open Bear > Help > API Token > Copy Token
  2. Save it: `echo "YOUR_TOKEN" > ~/.config/grizzly/token`

## Commands

### Create a Note

```bash
# Create with content piped in
echo "Note content here" | grizzly create --title "My Note" --tag work

# Create empty note with tag
grizzly create --title "Quick Note" --tag inbox < /dev/null
```

### Read a Note

```bash
grizzly open-note --id "NOTE_ID" --enable-callback --json
```

### Append Text to a Note

```bash
echo "Additional content" | grizzly add-text --id "NOTE_ID" --mode append --token-file ~/.config/grizzly/token
```

### List Tags

```bash
grizzly tags --enable-callback --json --token-file ~/.config/grizzly/token
```

### Search by Tag

```bash
grizzly open-tag --name "work" --enable-callback --json
```

## Common Flags

- `--dry-run` — Preview the URL without executing
- `--enable-callback` — Wait for Bear's response (needed for reading data)
- `--json` — JSON output (with callbacks)
- `--token-file PATH` — Path to Bear API token file

## Configuration

Grizzly reads config from (in priority order):
1. CLI flags
2. Environment variables (`GRIZZLY_TOKEN_FILE`, `GRIZZLY_CALLBACK_URL`, `GRIZZLY_TIMEOUT`)
3. `.grizzly.toml` in current directory
4. `~/.config/grizzly/config.toml`

Example `~/.config/grizzly/config.toml`:
```toml
token_file = "~/.config/grizzly/token"
callback_url = "http://127.0.0.1:42123/success"
timeout = "5s"
```

## Notes

- macOS only — Bear must be running for commands to work
- Note IDs are Bear's internal identifiers (visible in note info or via callbacks)
- Use `--enable-callback` when you need to read data back from Bear
