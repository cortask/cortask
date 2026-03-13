---
name: slack
description: "Control Slack: send messages, react, pin/unpin, read messages, and manage channels. Use when a user mentions Slack or wants to post, read, or react in Slack channels. Do NOT use for Discord."
metadata:
    emoji: "💬"
    tags:
        - slack
        - messaging
        - communication
    homepage: https://api.slack.com
---

# Slack Skill

Interact with Slack via the Slack API using curl and a bot token.

## When to Use

- "Send a message to #general on Slack"
- "React to that Slack message"
- "Pin that message in Slack"
- "Read recent messages from a Slack channel"

## Setup

1. Create a Slack app at https://api.slack.com/apps
2. Add bot scopes: `chat:write`, `reactions:write`, `reactions:read`, `pins:write`, `pins:read`, `channels:history`, `users:read`, `emoji:read`
3. Install the app to your workspace
4. Copy the Bot User OAuth Token (`xoxb-...`)
5. Store it in the credential store as the Slack Bot Token

## Commands

All commands use curl with the Slack API. The bot token is available as `$SLACK_BOT_TOKEN`.

### Send a Message

```bash
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "text": "Hello from Cortask!"}'
```

### React to a Message

```bash
curl -s -X POST https://slack.com/api/reactions.add \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "timestamp": "1712023032.1234", "name": "white_check_mark"}'
```

### List Reactions on a Message

```bash
curl -s "https://slack.com/api/reactions.get?channel=C123ABC&timestamp=1712023032.1234" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.message.reactions'
```

### Read Recent Messages

```bash
curl -s "https://slack.com/api/conversations.history?channel=C123ABC&limit=20" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.messages[] | {user, text, ts}'
```

### Edit a Message

```bash
curl -s -X POST https://slack.com/api/chat.update \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "ts": "1712023032.1234", "text": "Updated message"}'
```

### Delete a Message

```bash
curl -s -X POST https://slack.com/api/chat.delete \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "ts": "1712023032.1234"}'
```

### Pin a Message

```bash
curl -s -X POST https://slack.com/api/pins.add \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "timestamp": "1712023032.1234"}'
```

### Unpin a Message

```bash
curl -s -X POST https://slack.com/api/pins.remove \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123ABC", "timestamp": "1712023032.1234"}'
```

### List Pins

```bash
curl -s "https://slack.com/api/pins.list?channel=C123ABC" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.items[] | {type, message: .message.text}'
```

### Get Member Info

```bash
curl -s "https://slack.com/api/users.info?user=U123ABC" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.user | {name, real_name, email: .profile.email}'
```

### List Custom Emoji

```bash
curl -s "https://slack.com/api/emoji.list" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" | jq '.emoji | keys[:10]'
```

## Troubleshooting

### "not_in_channel" error

The bot must be **invited** to a channel before it can read or post. Ask the user to type `/invite @botname` in the channel.

### "missing_scope" error

The Slack app is missing required OAuth scopes. The user needs to add the scope in the app settings (api.slack.com/apps) and reinstall the app.

### "channel_not_found"

Channel IDs change if channels are recreated. Use `conversations.list` to find the current ID.

## Notes

- Channel IDs (C123ABC) and message timestamps (1712023032.1234) are needed for most operations
- Timestamps serve as message IDs in Slack
- The bot must be invited to channels before it can read/write
- API reference: https://api.slack.com/methods
