#!/usr/bin/env bash
set -euo pipefail

osascript <<'EOF'
tell application "Reminders"
  set listNames to name of every list
  repeat with listName in listNames
    log listName
  end repeat
end tell
EOF
