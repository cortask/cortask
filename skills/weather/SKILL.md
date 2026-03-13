---
name: weather
description: "Get current weather and forecasts via wttr.in. Use when the user asks about weather, temperature, or forecasts for any location. No API key needed."
requires:
  bins:
    - curl
metadata:
  emoji: "🌤️"
  tags:
    - weather
    - utility
  homepage: https://wttr.in/:help
---

# Weather Skill

Get current weather conditions and forecasts using wttr.in and curl.

## When to Use

- "What's the weather in Berlin?"
- "Will it rain tomorrow?"
- "Temperature in New York"
- "Weather forecast for the week"

## Commands

### Current Weather

```bash
# One-line summary
curl -s "wttr.in/Berlin?format=3"

# Detailed current conditions
curl -s "wttr.in/Berlin?0"
```

### Forecasts

```bash
# 3-day forecast
curl -s "wttr.in/Berlin"

# Specific day (0=today, 1=tomorrow, 2=day after)
curl -s "wttr.in/Berlin?1"
```

### Format Options

```bash
# Custom one-liner
curl -s "wttr.in/Berlin?format=%l:+%c+%t+(feels+like+%f),+%w+wind,+%h+humidity"

# JSON output for parsing
curl -s "wttr.in/Berlin?format=j1"
```

### Format Codes

- `%c` — Weather condition emoji
- `%t` — Temperature
- `%f` — "Feels like"
- `%w` — Wind
- `%h` — Humidity
- `%p` — Precipitation
- `%l` — Location

## Quick Answers

**"What's the weather?"** — Use `curl -s "wttr.in/{city}?format=3"`

**"Will it rain?"** — Use `curl -s "wttr.in/{city}?format=%l:+%c+%p"`

**"Weekend forecast"** — Use `curl -s "wttr.in/{city}?format=v2"`

## Notes

- No API key needed
- Works for most global cities and airport codes (e.g. `wttr.in/ORD`)
- Rate limited — don't spam requests
- Always include a city or location in the URL
