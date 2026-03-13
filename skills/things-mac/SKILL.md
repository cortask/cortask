---
name: things-mac
description: "Manage Things 3 tasks via the things CLI on macOS (read inbox/today/upcoming, add/update todos). Use when a user mentions Things or Things 3, wants to check their today list, or add tasks to Things. Do NOT use for Apple Reminders or Trello."
os:
  - darwin
requires:
  bins:
    - things
install:
  - kind: go
    module: github.com/ossianhempel/things3-cli/cmd/things@latest
    bins: [things]
    label: "Install things3-cli (go)"
metadata:
  emoji: "✅"
  tags:
    - tasks
    - things
    - productivity
    - macos
  homepage: https://github.com/ossianhempel/things3-cli
---

# Things 3 Skill

Use `things` to read your local Things 3 database and add/update todos via the Things URL scheme on macOS.

## When to Use

- "Show my Things inbox"
- "What's on my today list?"
- "Add a task to Things"
- "Search my Things tasks"

## Setup

- Install: `go install github.com/ossianhempel/things3-cli/cmd/things@latest`
- If DB reads fail: grant **Full Disk Access** to Terminal (System Settings > Privacy > Full Disk Access)
- Optional: set `THINGS_AUTH_TOKEN` env var for update operations

## Read Commands (Database)

```bash
things inbox --limit 50     # Inbox items
things today                # Today's tasks
things upcoming             # Upcoming tasks
things search "query"       # Search tasks
things projects             # List projects
things areas                # List areas
things tags                 # List tags
```

## Write Commands (URL Scheme)

### Add a Task

```bash
# Basic
things add "Buy milk"

# With details
things add "Buy milk" --notes "2% + bananas"

# Into a project
things add "Book flights" --list "Travel"

# With a heading in a project
things add "Pack charger" --list "Travel" --heading "Before"

# With tags
things add "Call dentist" --tags "health,phone"

# With a checklist
things add "Trip prep" --checklist-item "Passport" --checklist-item "Tickets"

# With due date
things add "Submit report" --when today --deadline 2026-03-01

# Preview URL without executing
things --dry-run add "Test task"
```

### Update a Task

Requires auth token (`THINGS_AUTH_TOKEN` env var or `--auth-token`).

```bash
# Get the task UUID first
things search "milk" --limit 5

# Update title
things update --id <UUID> --auth-token <TOKEN> "New title"

# Update notes
things update --id <UUID> --auth-token <TOKEN> --notes "New notes"
things update --id <UUID> --auth-token <TOKEN> --append-notes "Extra info"

# Move to another list
things update --id <UUID> --auth-token <TOKEN> --list "Travel"

# Complete or cancel
things update --id <UUID> --auth-token <TOKEN> --completed
things update --id <UUID> --auth-token <TOKEN> --canceled
```

## Notes

- macOS only — requires Things 3 to be installed
- `--dry-run` prints the URL without opening Things (useful for preview)
- No delete command — use `--completed` or `--canceled` instead
- Read operations access the local SQLite database directly
- Write operations use the Things URL scheme
