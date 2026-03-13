#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  delete.sh <note-title>

Example:
  delete.sh "Old Note"
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

note_title="${1:-}"

osascript <<EOF
tell application "Notes"
  try
    set theNote to first note whose name is "$note_title"
    delete theNote
    return "Deleted: $note_title"
  on error
    return "Note not found: $note_title"
  end try
end tell
EOF
