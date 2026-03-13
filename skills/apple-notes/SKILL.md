---
name: apple-notes
description: "Manage Apple Notes via AppleScript on macOS (create, view, search, delete). Use when a user explicitly mentions Apple Notes or wants notes that sync to iPhone/iPad via iCloud. Do NOT use for Bear notes or Obsidian."
compatibility:
  os:
    - darwin
metadata:
  emoji: "📝"
  tags:
    - notes
    - apple
    - productivity
    - macos
  homepage: https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/
---

# Apple Notes Skill

Manage Apple Notes using AppleScript (built into macOS). Notes sync across devices via iCloud.

## When to Use

- "Add a note to Apple Notes"
- "Search my notes"
- "List my notes"
- "Create a note"

## Setup

No installation needed - uses built-in macOS AppleScript.

**Permissions:**
- Grant Terminal/IDE access to Notes when prompted
- System Settings → Privacy & Security → Automation

## Commands

### Using the Scripts

```bash
# List all notes
{baseDir}/scripts/list.sh

# List notes from specific folder
{baseDir}/scripts/list.sh "Personal"

# Create a note
{baseDir}/scripts/create.sh "My Note Title"

# Create with folder and body
{baseDir}/scripts/create.sh "Meeting Notes" --folder "Work" --body "Attendees: Alice, Bob"

# Search notes
{baseDir}/scripts/search.sh "meeting"

# Delete a note
{baseDir}/scripts/delete.sh "Old Note"
```

### Direct AppleScript

```bash
# List all notes
osascript -e 'tell application "Notes" to get name of every note'

# Create a note
osascript <<EOF
tell application "Notes"
  tell folder "Notes"
    make new note with properties {name:"My Note", body:"Note content here"}
  end tell
end tell
EOF

# Search notes
osascript <<'EOF'
tell application "Notes"
  set matchingNotes to {}
  repeat with theNote in every note
    if name of theNote contains "query" then
      set end of matchingNotes to name of theNote
    end if
  end repeat
  return matchingNotes
end tell
EOF

# Delete a note
osascript <<'EOF'
tell application "Notes"
  delete (first note whose name is "My Note")
end tell
EOF
```

## Note Properties

- `name` — Note title
- `body` — Note content (HTML)
- `folder` — Parent folder
- `creation date` — When created
- `modification date` — Last modified

## Limitations

- AppleScript access to Notes is read/create/delete only
- Cannot directly edit existing note content via AppleScript
- HTML content may require parsing for plain text extraction

## Notes

- **macOS only** — requires Apple Notes.app
- Notes sync to all Apple devices via iCloud
- No external dependencies needed
- Requires Automation permissions for Terminal/IDE
