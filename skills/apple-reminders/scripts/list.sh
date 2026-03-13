#!/usr/bin/env bash
set -euo pipefail

list_name="${1:-}"

if [[ -z "$list_name" ]]; then
  # List all reminders from all lists
  osascript <<'EOF'
tell application "Reminders"
  repeat with theList in every list
    set listName to name of theList
    log "--- " & listName & " ---"
    repeat with theReminder in (reminders of theList whose completed is false)
      set reminderName to name of theReminder
      set isCompleted to completed of theReminder
      try
        set dueDate to due date of theReminder
        log "☐ " & reminderName & " (due: " & dueDate & ")"
      on error
        log "☐ " & reminderName
      end try
    end repeat
  end repeat
end tell
EOF
else
  # List reminders from specific list
  osascript -e "tell application \"Reminders\" to get name of every reminder of list \"$list_name\" whose completed is false"
fi
