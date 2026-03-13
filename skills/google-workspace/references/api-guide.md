# Google Workspace API Guide

Detailed API examples for each Google Workspace service.

## Gmail

### Search messages
```
google_api(method: "GET", url: "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:7d&maxResults=10")
```

### Get a message (full format)
```
google_api(method: "GET", url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}?format=full")
```

### Get message metadata only
```
google_api(method: "GET", url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date")
```

### Send an email
```
google_api(method: "POST", url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", body: '{"raw":"<base64url-encoded-RFC2822>"}')
```

To build the `raw` field: Base64url-encode a string like:
```
From: me@gmail.com
To: recipient@example.com
Subject: Hello

Message body here.
```

### Create a draft
```
google_api(method: "POST", url: "https://gmail.googleapis.com/gmail/v1/users/me/drafts", body: '{"message":{"raw":"<base64url-encoded-RFC2822>"}}')
```

### List labels
```
google_api(method: "GET", url: "https://gmail.googleapis.com/gmail/v1/users/me/labels")
```

### Gmail search operators
- `from:user@example.com` — from a sender
- `to:user@example.com` — to a recipient
- `subject:meeting` — subject contains
- `newer_than:7d` — last 7 days
- `older_than:1m` — older than 1 month
- `is:unread` — unread messages
- `in:inbox` — in inbox
- `has:attachment` — has attachment
- `label:important` — by label

## Calendar

### List events
```
google_api(method: "GET", url: "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=2026-02-01T00:00:00Z&timeMax=2026-02-28T23:59:59Z&maxResults=50&singleEvents=true&orderBy=startTime")
```

### Create an event
```
google_api(method: "POST", url: "https://www.googleapis.com/calendar/v3/calendars/primary/events", body: '{"summary":"Meeting","start":{"dateTime":"2026-02-24T10:00:00+01:00"},"end":{"dateTime":"2026-02-24T11:00:00+01:00"},"description":"Agenda..."}')
```

### Update an event
```
google_api(method: "PATCH", url: "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}", body: '{"summary":"Updated Title"}')
```

### Delete an event
```
google_api(method: "DELETE", url: "https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}")
```

### List calendars
```
google_api(method: "GET", url: "https://www.googleapis.com/calendar/v3/users/me/calendarList")
```

## Drive

### Search files
```
google_api(method: "GET", url: "https://www.googleapis.com/drive/v3/files?q=name contains 'report'&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=20")
```

### Get file metadata
```
google_api(method: "GET", url: "https://www.googleapis.com/drive/v3/files/{fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink")
```

### Export Google Doc as text
```
google_api(method: "GET", url: "https://www.googleapis.com/drive/v3/files/{fileId}/export?mimeType=text/plain")
```

### Drive search query operators
- `name contains 'budget'` — name contains
- `mimeType = 'application/vnd.google-apps.spreadsheet'` — spreadsheets only
- `modifiedTime > '2026-01-01T00:00:00'` — modified after
- `'me' in owners` — files I own
- `sharedWithMe` — shared with me
- `trashed = false` — not in trash

## Sheets

### Read cells
```
google_api(method: "GET", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:D10")
```

### Write cells
```
google_api(method: "PUT", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A1:B2?valueInputOption=USER_ENTERED", body: '{"values":[["Name","Score"],["Alice","95"]]}')
```

### Append rows
```
google_api(method: "POST", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A:C:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", body: '{"values":[["x","y","z"]]}')
```

### Clear cells
```
google_api(method: "POST", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/Sheet1!A2:Z:clear")
```

### Get spreadsheet metadata
```
google_api(method: "GET", url: "https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties")
```

## Docs

### Get document content
```
google_api(method: "GET", url: "https://docs.googleapis.com/v1/documents/{documentId}")
```

### Create a new document
```
google_api(method: "POST", url: "https://docs.googleapis.com/v1/documents", body: '{"title":"New Document"}')
```

## Contacts (People API)

### List contacts
```
google_api(method: "GET", url: "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=100")
```

### Search contacts
```
google_api(method: "GET", url: "https://people.googleapis.com/v1/people:searchContacts?query=John&readMask=names,emailAddresses,phoneNumbers&pageSize=10")
```
