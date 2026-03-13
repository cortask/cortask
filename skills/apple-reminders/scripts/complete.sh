#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  complete.sh <reminder-name>

Example:
  complete.sh "Buy milk"
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

reminder_name="${1:-}"

osascript <<EOF
tell application "Reminders"
  try
    set theReminder to first reminder whose name is "$reminder_name" and completed is false
    set completed of theReminder to true
    return "Completed: $reminder_name"
  on error
    return "Reminder not found: $reminder_name"
  end try
end tell
EOF
