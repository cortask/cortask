---
name: google-workspace
description: "Google Workspace: Gmail, Calendar, Drive, Contacts, Sheets, and Docs. Use when a user asks to send email via Gmail, check their calendar, manage Google Drive files, read or write spreadsheets, edit Google Docs, or look up contacts. Do NOT use for Google Search Console or local IMAP email."
tools:
    - name: google_api
      description: "Make a Google Workspace API call (Gmail, Calendar, Drive, Contacts, Sheets, Docs). Provide the full API URL, HTTP method, and optional JSON body."
      input:
          method:
              type: string
              description: "HTTP method"
              enum: [GET, POST, PUT, PATCH, DELETE]
          url:
              type: string
              description: "Full Google API URL"
          body:
              type: string
              description: "JSON request body (omit for GET/DELETE)"
              required: false
      request:
          url: "{{url}}"
          method: "{{method}}"
          headers:
              Authorization: "Bearer {{oauth2:accessToken}}"
              Content-Type: "application/json"
              Accept: "application/json"
          body: "{{body}}"
metadata:
    emoji: "📧"
    tags:
        - google
        - gmail
        - calendar
        - drive
        - sheets
        - docs
    homepage: https://developers.google.com/workspace
---

# Google Workspace

Interact with Google Workspace services via their REST APIs. OAuth2 handles authentication automatically.

For detailed API examples per service, see `references/api-guide.md`.

## Setup

1. Go to https://console.cloud.google.com
2. Create a project (or select existing)
3. Enable the APIs you need (APIs & Services → Library):
    - Gmail API
    - Google Calendar API
    - Google Drive API
    - Google Sheets API
    - Google Docs API
    - People API (for contacts)
4. Create OAuth 2.0 credentials (APIs & Services → Credentials → Create Credentials → OAuth client ID)
    - Application type: **Web application**
    - Authorized redirect URI: `http://localhost:4280/api/skills/google-workspace/oauth2/callback`
5. In Cortask UI → Skills → google-workspace:
    - Enter the Client ID and Client Secret
    - Click **Connect** to authorize

## API Base URLs

| Service  | Base URL                                        |
| -------- | ----------------------------------------------- |
| Gmail    | `https://gmail.googleapis.com/gmail/v1`         |
| Calendar | `https://www.googleapis.com/calendar/v3`        |
| Drive    | `https://www.googleapis.com/drive/v3`           |
| Sheets   | `https://sheets.googleapis.com/v4/spreadsheets` |
| Docs     | `https://docs.googleapis.com/v1/documents`      |
| People   | `https://people.googleapis.com/v1`              |

## Quick Examples

### Gmail — Search messages

```
google_api(method: "GET", url: "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:7d&maxResults=10")
```

### Calendar — List events

```
google_api(method: "GET", url: "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=2026-02-01T00:00:00Z&timeMax=2026-02-28T23:59:59Z&maxResults=50&singleEvents=true&orderBy=startTime")
```

### Drive — Search files

```
google_api(method: "GET", url: "https://www.googleapis.com/drive/v3/files?q=name contains 'report'&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=20")
```

### Sheets — Read cells

```
google_api(method: "GET", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:D10")
```

### Docs — Get document

```
google_api(method: "GET", url: "https://docs.googleapis.com/v1/documents/{documentId}")
```

### Contacts — Search

```
google_api(method: "GET", url: "https://people.googleapis.com/v1/people:searchContacts?query=John&readMask=names,emailAddresses,phoneNumbers&pageSize=10")
```

## Troubleshooting

### OAuth token expired

If API calls return 401, the OAuth token may have expired. Ask the user to reconnect in Cortask UI → Skills → google-workspace → Reconnect.

### API not enabled

If you get a 403 "API has not been used in project" error, the user needs to enable the specific API in Google Cloud Console (APIs & Services → Library).

### Insufficient scopes

If you get a 403 "insufficient permission" error, the OAuth consent may be missing scopes. The user should disconnect and reconnect to re-authorize with updated scopes.

## Notes

- Always confirm before sending emails or creating calendar events.
- Use `fields` parameter to limit response size (especially for Drive and Sheets).
- Gmail message bodies are base64url-encoded. Decode `payload.body.data` or `parts[].body.data` to read content.
- Calendar times must include timezone offset or use UTC (Z suffix).
- Sheets `valueInputOption`: `USER_ENTERED` (parsed like UI input) or `RAW` (stored as-is).
