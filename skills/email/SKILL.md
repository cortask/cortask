---
name: email
description: Send and receive emails via IMAP/SMTP. Supports multiple accounts.
metadata:
  tags:
    - email
    - communication
    - imap
    - smtp
---

# Email

You have access to email tools for reading and sending emails via IMAP/SMTP.

## Usage

- Always call `list_email_accounts` first to see which accounts are available.
- Check workspace memory for which email account to use for this project.
- If the user hasn't specified a preferred account, ask which one to use.
- Use the `account` parameter on all tools to target a specific account (by label or ID).

## Common workflows

- **Check inbox**: `read_emails` with `unread_only: true`
- **Search**: `search_emails` with a query string
- **Read full email**: `read_email` with the message sequence number
- **Reply**: `reply_email` with the original message ID and your response body
- **Send new**: `send_email` with recipient, subject, and body
- **Organize**: `move_email` to move messages between folders

## Gmail setup

For Gmail accounts, the user needs to create an App Password:
1. Go to Google Account > Security > 2-Step Verification > App passwords
2. Generate a new app password for "Mail"
3. Use that password (not the regular Google password)
4. IMAP host: `imap.gmail.com`, SMTP host: `smtp.gmail.com`
