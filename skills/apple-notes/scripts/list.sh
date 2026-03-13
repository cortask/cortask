#!/usr/bin/env bash
set -euo pipefail

folder_name="${1:-}"

if [[ -z "$folder_name" ]]; then
  # List all notes from all folders
  osascript <<'EOF'
tell application "Notes"
  repeat with theFolder in every folder
    set folderName to name of theFolder
    log "--- " & folderName & " ---"
    repeat with theNote in (notes of theFolder)
      set noteName to name of theNote
      log "• " & noteName
    end repeat
  end repeat
end tell
EOF
else
  # List notes from specific folder
  osascript -e "tell application \"Notes\" to get name of every note of folder \"$folder_name\""
fi
