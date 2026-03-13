---
name: spotify
description: "Control Spotify playback and search via spotify-player CLI. Use when a user wants to play music, search tracks, or control Spotify."
metadata:
  emoji: "🎵"
  tags:
    - spotify
    - music
    - media
    - cli
  homepage: https://github.com/aome510/spotify-player
---

# Spotify CLI Skill

Control Spotify playback and search for music using the `spotify-player` CLI.

## When to Use

- "Play some music on Spotify"
- "Search for a song"
- "Skip to the next track"
- "What's currently playing?"
- "Pause/resume playback"

## Setup

### Install spotify-player

**macOS/Linux:**
```bash
# Homebrew
brew install spotify-player

# Cargo (Rust)
cargo install spotify_player
```

**Windows:**
```bash
# Scoop
scoop install spotify-player

# Cargo
cargo install spotify_player
```

### Configure

1. Run `spotify-player` once to generate config
2. Edit `~/.config/spotify-player/app.toml`:
   ```toml
   [app_config]
   theme = "default"
   client_id = "your_client_id"  # Optional: Get from https://developer.spotify.com/dashboard
   ```

3. Authenticate:
   - On first run, follow OAuth flow in browser
   - Credentials stored in `~/.cache/spotify-player/`

## Commands

### Playback Control

```bash
spotify_player playback play          # Resume playback
spotify_player playback pause         # Pause
spotify_player playback next          # Next track
spotify_player playback previous      # Previous track
spotify_player playback shuffle       # Toggle shuffle
spotify_player playback repeat        # Cycle repeat mode
spotify_player playback volume 50     # Set volume (0-100)
```

### Search & Play

```bash
# Search
spotify_player search track "Bohemian Rhapsody"
spotify_player search album "A Night at the Opera"
spotify_player search artist "Queen"
spotify_player search playlist "Rock Classics"

# Play from URI
spotify_player play --uri "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp"
```

### Get Info

```bash
# Current track
spotify_player get currently-playing

# Devices
spotify_player get devices

# Playlists
spotify_player get user-playlists

# Liked tracks
spotify_player get user-liked-tracks
```

### Device Management

```bash
# List devices
spotify_player connect

# Switch device
spotify_player connect --device "My Speaker"
```

### Library Management

```bash
# Like current track
spotify_player like

# Unlike current track
spotify_player unlike

# Save to playlist
spotify_player add-to-playlist "My Playlist"
```

### Interactive TUI

```bash
# Launch terminal UI (default)
spotify_player

# With specific config
spotify_player --config ~/.config/spotify-player/custom.toml
```

## Configuration

**Location:** `~/.config/spotify-player/app.toml`

**Common settings:**
```toml
[app_config]
client_id = "your_client_id"          # Optional: custom app ID
tracks_playback_limit = 50             # Playlist track limit
app_refresh_duration_in_ms = 32        # UI refresh rate

[theme]
themes = ["default", "dracula"]
```

## Notes

- **Requires Spotify Premium** for playback control
- Free accounts can browse but not control playback
- OAuth credentials cached after first auth
- TUI supports vim keybindings
- Works with Spotify Connect (control any device)
- Supports streaming to local device or remote via Connect

## Alternative: spotify-tui + spotifyd

For a lighter setup, use `spotify-tui` (UI) + `spotifyd` (daemon):

```bash
# Install
brew install spotify-tui spotifyd

# Start daemon
spotifyd --no-daemon

# Launch TUI
spt
```
