#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  create.sh <title> [--folder <folder-name>] [--body <text>]

Examples:
  create.sh "My Note"
  create.sh "Shopping List" --folder "Personal"
  create.sh "Meeting Notes" --body "Attendees: Alice, Bob"
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

title="${1:-}"
shift || true

folder_name="Notes"
body=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --folder)
      folder_name="${2:-}"
      shift 2
      ;;
    --body)
      body="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

# Create note
if [[ -n "$body" ]]; then
  osascript <<EOF
tell application "Notes"
  tell folder "$folder_name"
    make new note with properties {name:"$title", body:"$body"}
  end tell
end tell
EOF
else
  osascript <<EOF
tell application "Notes"
  tell folder "$folder_name"
    make new note with properties {name:"$title"}
  end tell
end tell
EOF
fi

echo "Created: $title"
