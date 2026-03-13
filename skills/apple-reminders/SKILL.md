---
name: apple-reminders
description: "Manage Apple Reminders via AppleScript on macOS (list, add, complete, delete). Use when a user mentions Apple Reminders or wants reminders that sync to iPhone/iPad. Do NOT use for Things 3 tasks, Trello cards, or scheduling agent cron jobs."
compatibility:
  os:
    - darwin
metadata:
  emoji: "⏰"
  tags:
    - reminders
    - apple
    - productivity
    - macos
  homepage: https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/
---

# Apple Reminders Skill

Manage Apple Reminders using AppleScript (built into macOS). Reminders sync to iPhone/iPad via iCloud.

## When to Use

- "Add a reminder to buy milk"
- "What are my reminders?"
- "Show me my reminders list"
- "Complete that reminder"
- User wants tasks in Apple Reminders (syncs to their phone)

## When NOT to Use

- Scheduling agent tasks or alerts — use the `cron` tool instead
- Calendar events — use a calendar tool
- Project management — use Trello, GitHub Issues, etc.
- If user says "remind me" but means an agent alert — clarify first

## Setup

No installation needed - uses built-in macOS AppleScript.

**Permissions:**
- Grant Terminal/IDE access to Reminders when prompted
- System Settings → Privacy & Security → Automation

## Commands

### Using the Scripts

```bash
# List all reminders
{baseDir}/scripts/list.sh

# List reminders from specific list
{baseDir}/scripts/list.sh "Work"

# Add a reminder
{baseDir}/scripts/add.sh "Buy milk"

# Add to specific list
{baseDir}/scripts/add.sh "Call mom" --list "Personal"

# Add with due date
{baseDir}/scripts/add.sh "Meeting prep" --due "2026-03-15 09:00"

# Complete a reminder by name
{baseDir}/scripts/complete.sh "Buy milk"

# Get all lists
{baseDir}/scripts/lists.sh
```

### Direct AppleScript

```bash
# List all reminders
osascript -e 'tell application "Reminders" to get name of every reminder'

# Add a reminder
osascript -e 'tell application "Reminders" to make new reminder with properties {name:"Buy milk"}'

# Add to specific list with due date
osascript <<EOF
tell application "Reminders"
  tell list "Personal"
    make new reminder with properties {name:"Call mom", due date:date "Friday, March 15, 2026 at 9:00:00 AM"}
  end tell
end tell
EOF

# Complete a reminder
osascript <<EOF
tell application "Reminders"
  set theReminder to first reminder whose name is "Buy milk"
  set completed of theReminder to true
end tell
EOF

# Get all lists
osascript -e 'tell application "Reminders" to get name of every list'

# Delete a reminder
osascript <<EOF
tell application "Reminders"
  delete (first reminder whose name is "Buy milk")
end tell
EOF
```

## AppleScript Properties

### Reminder Properties
- `name` — Reminder title
- `body` — Notes/description
- `due date` — Due date (date object)
- `remind me date` — Alert date
- `completed` — Boolean (true/false)
- `priority` — 0 (none), 1 (low), 5 (medium), 9 (high)

### Example with All Properties

```bash
osascript <<EOF
tell application "Reminders"
  tell list "Work"
    make new reminder with properties {
      name:"Finish report",
      body:"Include Q1 metrics",
      due date:date "Monday, March 10, 2026 at 5:00:00 PM",
      priority:9
    }
  end tell
end tell
EOF
```

## Date Format

AppleScript uses natural date format:
- `date "March 15, 2026"`
- `date "Friday, March 15, 2026 at 9:00:00 AM"`
- `date "3/15/2026"`

You can also use relative dates in the scripts:
- `tomorrow`
- `next week`

## Notes

- **macOS only** — requires Apple Reminders app
- Reminders sync to all Apple devices via iCloud
- No external dependencies needed
- Requires Automation permissions for Terminal/IDE
- AppleScript is built into macOS
