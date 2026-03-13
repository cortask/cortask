---
name: himalaya
description: "CLI email client via IMAP/SMTP. List, read, write, reply, forward, search, and organize emails. Use when a user wants to check, send, or manage email via IMAP. Do NOT use for Gmail via Google Workspace API (use google-workspace skill instead)."
requires:
    bins:
        - himalaya
install:
    - kind: brew
      formula: himalaya
      bins: [himalaya]
      os: [darwin, linux]
      label: "Install himalaya (brew)"
metadata:
    emoji: "📧"
    tags:
        - email
        - communication
        - imap
        - smtp
    homepage: https://github.com/pimalaya/himalaya
---

# Himalaya Email Skill

Use `himalaya` to manage emails from the terminal via IMAP/SMTP.

## When to Use

- "Check my email"
- "Send an email to..."
- "Reply to that email"
- "Search my emails for..."

## References

- `references/configuration.md` — Config file setup, IMAP/SMTP auth, Gmail/iCloud examples
- `references/message-composition.md` — MML syntax for composing rich emails with attachments

## Setup

Run the interactive setup wizard:

```bash
himalaya account configure
```

Or create `~/.config/himalaya/config.toml` manually (see `references/configuration.md`).

## Common Commands

### List Emails

```bash
# Inbox (default)
himalaya envelope list

# Specific folder
himalaya envelope list --folder "Sent"

# With pagination
himalaya envelope list --page 1 --page-size 20
```

### Search Emails

```bash
himalaya envelope list from john@example.com subject meeting
```

### Read an Email

```bash
himalaya message read 42
```

### Reply

```bash
# Reply (opens editor)
himalaya message reply 42

# Reply-all
himalaya message reply 42 --all
```

### Forward

```bash
himalaya message forward 42
```

### Write a New Email

```bash
# Interactive compose (opens $EDITOR)
himalaya message write

# Send directly via template
cat << 'EOF' | himalaya template send
From: you@example.com
To: recipient@example.com
Subject: Test Message

Hello from Cortask!
EOF

# With headers
himalaya message write -H "To:recipient@example.com" -H "Subject:Test" "Message body"
```

### Move / Copy / Delete

```bash
himalaya message move 42 "Archive"
himalaya message copy 42 "Important"
himalaya message delete 42
```

### Manage Flags

```bash
himalaya flag add 42 --flag seen
himalaya flag remove 42 --flag seen
```

### Attachments

```bash
himalaya attachment download 42
himalaya attachment download 42 --dir ~/Downloads
```

### List Folders

```bash
himalaya folder list
```

### Multiple Accounts

```bash
himalaya account list
himalaya --account work envelope list
```

### Output Formats

```bash
himalaya envelope list --output json
himalaya envelope list --output plain
```

## Notes

- Configuration file: `~/.config/himalaya/config.toml`
- Message IDs are relative to the current folder — re-list after folder changes
- For rich emails with attachments, use MML syntax (see `references/message-composition.md`)
- Store passwords securely using `pass`, system keyring, or a command
- Gmail requires an App Password if 2FA is enabled
