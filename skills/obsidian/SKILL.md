---
name: obsidian
description: "Work with Obsidian vaults (plain Markdown notes) via obsidian-cli. Use when a user mentions Obsidian, wants to search their vault, or create/move notes in Obsidian. Do NOT use for Apple Notes or Bear."
requires:
  bins:
    - obsidian-cli
install:
  - kind: brew
    formula: yakitrak/yakitrak/obsidian-cli
    bins: [obsidian-cli]
    os: [darwin, linux]
    label: "Install obsidian-cli (brew)"
metadata:
  emoji: "💎"
  tags:
    - obsidian
    - notes
    - productivity
    - markdown
  homepage: https://help.obsidian.md
---

# Obsidian Skill

Work with Obsidian vaults using `obsidian-cli`. An Obsidian vault is just a folder of Markdown files on disk.

## When to Use

- "Search my Obsidian notes"
- "Create a note in Obsidian"
- "Move a note to another folder"
- "What's in my vault?"

## Vault Discovery

Obsidian tracks vaults in:
- macOS: `~/Library/Application Support/obsidian/obsidian.json`

```bash
# Show default vault path
obsidian-cli print-default --path-only

# Set default vault (run once)
obsidian-cli set-default "vault-folder-name"
```

Multiple vaults are common (work/personal, iCloud/local). Don't hardcode vault paths — read the config or use `print-default`.

## Commands

### Search

```bash
# Search note names
obsidian-cli search "query"

# Search inside note content (with snippets)
obsidian-cli search-content "query"
```

### Create

```bash
# Create a note (opens in Obsidian)
obsidian-cli create "Folder/New note" --content "Note body here" --open
```

Avoid creating notes under hidden dot-folders — Obsidian may refuse via URI handler.

### Move / Rename

```bash
# Move and update all wikilinks across the vault
obsidian-cli move "old/path/note" "new/path/note"
```

This is the main advantage over `mv` — it updates `[[wikilinks]]` and Markdown links throughout the vault.

### Delete

```bash
obsidian-cli delete "path/note"
```

### Direct File Editing

You can also edit `.md` files directly — Obsidian picks up changes automatically. Use `obsidian-cli` when you need vault-aware operations (search, move with link updates).

## Vault Structure

```
vault/
├── *.md           # Notes (plain Markdown)
├── *.canvas       # Canvas files (JSON)
├── .obsidian/     # Config & plugin settings (don't touch from scripts)
└── attachments/   # Images, PDFs, etc.
```

## Notes

- Cross-platform (macOS, Linux, Windows)
- Requires Obsidian to be installed for URI-based operations (create, open)
- Direct file reads/writes work without Obsidian running
