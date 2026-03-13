#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  add.sh <title> [--list <list-name>] [--due <date>] [--priority <0-9>]

Examples:
  add.sh "Buy milk"
  add.sh "Call mom" --list "Personal"
  add.sh "Meeting prep" --due "2026-03-15 09:00"
  add.sh "Urgent task" --priority 9
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

title="${1:-}"
shift || true

list_name="Reminders"
due_date=""
priority="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)
      list_name="${2:-}"
      shift 2
      ;;
    --due)
      due_date="${2:-}"
      shift 2
      ;;
    --priority)
      priority="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

# Build AppleScript
if [[ -n "$due_date" ]]; then
  osascript <<EOF
tell application "Reminders"
  tell list "$list_name"
    make new reminder with properties {name:"$title", due date:date "$due_date", priority:$priority}
  end tell
end tell
EOF
else
  osascript <<EOF
tell application "Reminders"
  tell list "$list_name"
    make new reminder with properties {name:"$title", priority:$priority}
  end tell
end tell
EOF
fi

echo "Added: $title"
