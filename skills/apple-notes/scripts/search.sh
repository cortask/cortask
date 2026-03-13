#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  search.sh <query>

Example:
  search.sh "meeting"
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

query="${1:-}"

osascript <<EOF
tell application "Notes"
  set matchingNotes to {}
  repeat with theNote in every note
    set noteName to name of theNote
    set noteBody to body of theNote
    if noteName contains "$query" or noteBody contains "$query" then
      set end of matchingNotes to noteName
    end if
  end repeat
  return matchingNotes
end tell
EOF
