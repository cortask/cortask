---
name: trello
description: "Manage Trello boards, lists, and cards via the Trello REST API. Use when a user mentions Trello, wants to create cards, move tasks between lists, or view their Trello boards. Do NOT use for GitHub Issues or Apple Reminders."
requires:
  bins:
    - curl
    - jq
metadata:
  emoji: "📋"
  tags:
    - trello
    - productivity
    - project-management
  homepage: https://developer.atlassian.com/cloud/trello/rest/
---

# Trello Skill

Manage Trello boards, lists, and cards via the REST API.

## When to Use

- "Show my Trello boards"
- "Create a card in Trello"
- "Move that card to Done"
- "What's on my Trello board?"

## Commands

All commands use curl with the Trello API. Credentials are injected as `$TRELLO_API_KEY` and `$TRELLO_TOKEN` environment variables.

### List Boards

```bash
curl -s "https://api.trello.com/1/members/me/boards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq '.[] | {name, id}'
```

### List Lists in a Board

```bash
curl -s "https://api.trello.com/1/boards/{boardId}/lists?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq '.[] | {name, id}'
```

### List Cards in a List

```bash
curl -s "https://api.trello.com/1/lists/{listId}/cards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq '.[] | {name, id, desc}'
```

### Create a Card

```bash
curl -s -X POST "https://api.trello.com/1/cards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
  -d "idList={listId}" \
  -d "name=Card Title" \
  -d "desc=Card description"
```

### Move a Card

```bash
curl -s -X PUT "https://api.trello.com/1/cards/{cardId}?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
  -d "idList={newListId}"
```

### Add a Comment

```bash
curl -s -X POST "https://api.trello.com/1/cards/{cardId}/actions/comments?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
  -d "text=Your comment here"
```

### Archive a Card

```bash
curl -s -X PUT "https://api.trello.com/1/cards/{cardId}?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" \
  -d "closed=true"
```

### Search for a Board by Name

```bash
curl -s "https://api.trello.com/1/members/me/boards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN" | jq '.[] | select(.name | contains("Work"))'
```

## Troubleshooting

### 401 Unauthorized
The API key or token is invalid. The user should regenerate their token at https://trello.com/power-ups/admin.

### "board not found" or "invalid id"
Board/List/Card IDs are alphanumeric strings. Find them in the Trello URL (e.g., `trello.com/b/BOARD_ID/...`) or via the list commands above.

## Notes

- Board/List/Card IDs can be found in the Trello URL or via the list commands
- Rate limits: 300 requests per 10 seconds per API key; 100 requests per 10 seconds per token
- API reference: https://developer.atlassian.com/cloud/trello/rest/
