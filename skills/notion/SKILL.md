---
name: notion
description: "Search, create, and manage Notion pages and databases. Use when a user mentions Notion, wants to query a workspace, create pages, or update database entries."
tools:
  - name: notion_api
    description: "Make a Notion API call. Use for searching, reading, creating, or updating Notion pages and databases."
    input:
      method:
        type: string
        description: "HTTP method (GET, POST, PATCH, DELETE)"
        enum:
          - GET
          - POST
          - PATCH
          - DELETE
      path:
        type: string
        description: "API path after /v1/, e.g. 'pages', 'databases/abc/query', 'search'"
      body:
        type: string
        description: "JSON request body (for POST/PATCH)"
        required: false
    request:
      url: "https://api.notion.com/v1/{{path}}"
      method: "{{method}}"
      headers:
        Authorization: "Bearer {{credential:apiKey}}"
        Notion-Version: "2022-06-28"
        Content-Type: "application/json"
      body: "{{body}}"
metadata:
  emoji: "📝"
  tags:
    - notion
    - productivity
    - api
  homepage: https://developers.notion.com
---

# Notion Skill

Use the `notion_api` tool to interact with the Notion API.

## When to Use

- "Search my Notion workspace"
- "Create a page in Notion"
- "List databases in Notion"
- "Update a Notion page"

## Common Operations

### Search

```
notion_api(method: "POST", path: "search", body: '{"query": "Meeting Notes"}')
```

### Get a Page

```
notion_api(method: "GET", path: "pages/<page-id>")
```

### Query a Database

```
notion_api(method: "POST", path: "databases/<db-id>/query", body: '{"filter": {"property": "Status", "select": {"equals": "In Progress"}}}')
```

### Create a Page

```
notion_api(method: "POST", path: "pages", body: '{"parent": {"database_id": "<db-id>"}, "properties": {"Name": {"title": [{"text": {"content": "New Page"}}]}}}')
```

### Update a Page

```
notion_api(method: "PATCH", path: "pages/<page-id>", body: '{"properties": {"Status": {"select": {"name": "Done"}}}}')
```

## Troubleshooting

### "Could not find object" or empty results
The Notion integration must be **shared with** the specific pages or databases you want to access. In Notion, open the page → click "..." → "Connections" → add your integration.

### 401 Unauthorized
The API key is invalid or missing. Verify the integration token is correctly stored in the credential store.

### Property type mismatch
When creating/updating pages, property values must match the database schema exactly. Use `GET databases/<db-id>` to check property types before writing.

## Notes

- Requires a Notion internal integration API key
- The integration must be shared with the pages/databases you want to access
- API reference: https://developers.notion.com/reference
- All responses are JSON
