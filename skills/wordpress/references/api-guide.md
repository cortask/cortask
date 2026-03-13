# WordPress REST API Guide

Detailed API examples for all WordPress operations.

## Posts

```
# List recent published posts
wordpress_api(method: "GET", path: "wp/v2/posts", params: "per_page=10&status=publish")

# List drafts
wordpress_api(method: "GET", path: "wp/v2/posts", params: "status=draft")

# Search posts
wordpress_api(method: "GET", path: "wp/v2/posts", params: "search=keyword")

# Create a draft post
wordpress_api(method: "POST", path: "wp/v2/posts", body: '{"title":"My Post","content":"<p>Content here</p>","status":"draft","categories":[1],"tags":[5,8]}')

# Publish a draft (update status)
wordpress_api(method: "PUT", path: "wp/v2/posts/123", body: '{"status":"publish"}')

# Update post content
wordpress_api(method: "PUT", path: "wp/v2/posts/123", body: '{"content":"<p>New content</p>"}')

# Delete post (moves to trash)
wordpress_api(method: "DELETE", path: "wp/v2/posts/123")

# Permanently delete
wordpress_api(method: "DELETE", path: "wp/v2/posts/123", params: "force=true")
```

## Pages

```
# List pages
wordpress_api(method: "GET", path: "wp/v2/pages")

# Create page
wordpress_api(method: "POST", path: "wp/v2/pages", body: '{"title":"About Us","content":"<p>About page</p>","status":"publish"}')

# Update page
wordpress_api(method: "PUT", path: "wp/v2/pages/45", body: '{"content":"<p>Updated</p>"}')
```

## Media

```
# List media
wordpress_api(method: "GET", path: "wp/v2/media", params: "per_page=10")

# Get specific media details
wordpress_api(method: "GET", path: "wp/v2/media/67")

# Update media metadata (alt text, caption, title)
wordpress_api(method: "PUT", path: "wp/v2/media/67", body: '{"alt_text":"A cute alpaca","caption":"Photo of an alpaca","title":"Alpaca"}')
```

### Uploading Images / Files

The `wordpress_api` tool cannot upload binary files. Use `bash` with `curl` instead.

WordPress credentials are available as environment variables in bash: `%WORDPRESS_SITE_URL%`, `%WORDPRESS_USERNAME%`, `%WORDPRESS_APP_PASSWORD%` (Windows cmd.exe) or `$WORDPRESS_SITE_URL`, `$WORDPRESS_USERNAME`, `$WORDPRESS_APP_PASSWORD` (Unix shell).

```bash
# Upload a local file (Windows cmd.exe)
curl -X POST "%WORDPRESS_SITE_URL%/wp-json/wp/v2/media" -u "%WORDPRESS_USERNAME%:%WORDPRESS_APP_PASSWORD%" -H "Content-Disposition: attachment; filename=\"image.jpg\"" -H "Content-Type: image/jpeg" --data-binary @"C:\path\to\image.jpg"

# Download from URL then upload (Windows cmd.exe)
# First create the files folder for today's date (e.g., files/2026-03-02/)
mkdir files\2026-03-02 2>nul & curl -L -o files\2026-03-02\photo.jpg "https://example.com/photo.jpg" && curl -X POST "%WORDPRESS_SITE_URL%/wp-json/wp/v2/media" -u "%WORDPRESS_USERNAME%:%WORDPRESS_APP_PASSWORD%" -H "Content-Disposition: attachment; filename=\"photo.jpg\"" -H "Content-Type: image/jpeg" --data-binary @files\2026-03-02\photo.jpg

# Upload (Unix shell)
curl -X POST "$WORDPRESS_SITE_URL/wp-json/wp/v2/media" -u "$WORDPRESS_USERNAME:$WORDPRESS_APP_PASSWORD" -H "Content-Disposition: attachment; filename=\"image.jpg\"" -H "Content-Type: image/jpeg" --data-binary @"/path/to/image.jpg"

# Download from URL then upload (Unix shell)
# First create the files folder for today's date
mkdir -p files/2026-03-02 && curl -L -o files/2026-03-02/photo.jpg "https://example.com/photo.jpg" && curl -X POST "$WORDPRESS_SITE_URL/wp-json/wp/v2/media" -u "$WORDPRESS_USERNAME:$WORDPRESS_APP_PASSWORD" -H "Content-Disposition: attachment; filename=\"photo.jpg\"" -H "Content-Type: image/jpeg" --data-binary @files/2026-03-02/photo.jpg

# Set as featured image on a post (use the media ID from upload response)
wordpress_api(method: "PUT", path: "wp/v2/posts/123", body: '{"featured_media": MEDIA_ID}')
```

Content-Type by extension: `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.gif` → `image/gif`, `.webp` → `image/webp`, `.svg` → `image/svg+xml`, `.pdf` → `application/pdf`

The upload response returns a JSON object with `id` (media ID), `source_url`, and other metadata. Use `id` to set `featured_media` on posts.

## Categories & Tags

```
# List categories
wordpress_api(method: "GET", path: "wp/v2/categories")

# Create category
wordpress_api(method: "POST", path: "wp/v2/categories", body: '{"name":"Tech","description":"Technology posts"}')

# List tags
wordpress_api(method: "GET", path: "wp/v2/tags")

# Create tag
wordpress_api(method: "POST", path: "wp/v2/tags", body: '{"name":"javascript"}')
```

## Plugins

```
# List plugins (requires admin role)
wordpress_api(method: "GET", path: "wp/v2/plugins")

# Activate a plugin
wordpress_api(method: "PUT", path: "wp/v2/plugins/akismet/akismet", body: '{"status":"active"}')

# Deactivate a plugin
wordpress_api(method: "PUT", path: "wp/v2/plugins/akismet/akismet", body: '{"status":"inactive"}')
```

## Users

```
# List users
wordpress_api(method: "GET", path: "wp/v2/users")

# Get current user
wordpress_api(method: "GET", path: "wp/v2/users/me")
```

## Comments

```
# List comments
wordpress_api(method: "GET", path: "wp/v2/comments", params: "per_page=20")

# Approve a comment
wordpress_api(method: "PUT", path: "wp/v2/comments/99", body: '{"status":"approved"}')
```

## Site Settings

```
# Get settings
wordpress_api(method: "GET", path: "wp/v2/settings")

# Update site title
wordpress_api(method: "PUT", path: "wp/v2/settings", body: '{"title":"My Awesome Site"}')

# Update tagline
wordpress_api(method: "PUT", path: "wp/v2/settings", body: '{"description":"A better tagline"}')
```

## Search

```
# Search across content types
wordpress_api(method: "GET", path: "wp/v2/search", params: "search=keyword&per_page=10")
```

## Query Parameters

Common parameters for GET requests (pass via `params`):

| Parameter | Description | Example |
|-----------|-------------|---------|
| `per_page` | Results per page (max 100) | `per_page=20` |
| `page` | Page number for pagination | `page=2` |
| `search` | Search term | `search=hello` |
| `status` | Filter by status | `status=draft` |
| `orderby` | Sort field | `orderby=date` |
| `order` | Sort direction | `order=asc` |
| `_fields` | Limit returned fields | `_fields=id,title,status` |
| `categories` | Filter by category IDs | `categories=3,7` |
| `tags` | Filter by tag IDs | `tags=5` |
| `author` | Filter by author ID | `author=1` |
| `after` | Posts after date (ISO 8601) | `after=2026-01-01T00:00:00` |
| `before` | Posts before date (ISO 8601) | `before=2026-12-31T23:59:59` |
