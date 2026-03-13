---
name: wordpress
description: "Manage WordPress sites via REST API: create and edit posts/pages, manage media, plugins, users, categories, tags, and comments. Use when a user mentions WordPress, wants to publish a blog post, manage pages, upload media, or change site settings."
metadata:
    tags:
        - wordpress
        - cms
        - content
        - api
    homepage: https://developer.wordpress.org/rest-api/
---

# WordPress Skill

Use the `wordpress_api` tool to manage WordPress sites via the REST API.

For detailed API examples (pages, media, categories, plugins, users, comments, settings), see `references/api-guide.md`.

## Setup

1. Log in to your WordPress admin panel
2. Go to **Users → Profile**
3. Scroll down to **Application Passwords**
4. Enter a name (e.g. "cortask") and click **Add New Application Password**
5. Copy the generated password — **REMOVE ALL SPACES** before saving it in the skill credentials
    - WordPress shows: `Tz0M 9kCi 0jPb 3QU6 O8oC qMsN`
    - You must save: `Tz0M9kCi0jPb3QU6O8oCqMsN` (no spaces)

> Requires WordPress 5.6+ (Application Passwords are built in).
> Your site must use HTTPS for Application Passwords to work (unless localhost).
> **IMPORTANT:** Application Passwords include spaces for readability, but you MUST remove all spaces when storing the credential.

## When to Use

- "Create a new blog post on my WordPress site"
- "List my recent WordPress posts"
- "Update the title of page 42"
- "Upload an image to WordPress"
- "Check which plugins are installed"
- "List all draft posts"
- "Change my site tagline"

## Tool Usage

```
wordpress_api(method: "GET", path: "wp/v2/posts", params: "per_page=5&status=publish")
wordpress_api(method: "POST", path: "wp/v2/posts", body: '{"title":"Hello World","content":"Post body here","status":"draft"}')
wordpress_api(method: "PUT", path: "wp/v2/posts/123", body: '{"title":"Updated Title"}')
wordpress_api(method: "DELETE", path: "wp/v2/posts/123")
```

## Quick Examples

### List recent posts

```
wordpress_api(method: "GET", path: "wp/v2/posts", params: "per_page=10&status=publish&_fields=id,title,status,date")
```

### Create a draft post

```
wordpress_api(method: "POST", path: "wp/v2/posts", body: '{"title":"My Post","content":"<p>Content here</p>","status":"draft"}')
```

### Search posts

```
wordpress_api(method: "GET", path: "wp/v2/posts", params: "search=keyword")
```

## Presenting Results

When showing WordPress data, format as markdown tables:

| ID  | Title   | Status  | Date       | Author |
| --- | ------- | ------- | ---------- | ------ |
| 123 | My Post | publish | 2026-02-20 | admin  |

Use `_fields` parameter to keep responses concise: `_fields=id,title.rendered,status,date`

## Troubleshooting

### Authentication fails (401)

- Verify the Application Password has **no spaces** in the stored credential
- Ensure HTTPS is enabled on the WordPress site (required for Application Passwords)
- Check that the WordPress user has sufficient permissions

### REST API disabled (404 on /wp-json)

- Some security plugins disable the REST API. Check plugin settings.
- Verify permalinks are enabled (Settings → Permalinks → save)

### Forbidden (403)

- The user may lack permission for the operation (e.g., plugin management requires admin role)
- Check if a security plugin is blocking REST API access

## Notes

- All content fields use `rendered` and `raw` subfields (e.g. `title.rendered` for display, `title.raw` for editing)
- POST/PUT body content should be HTML
- The `status` field accepts: `publish`, `draft`, `pending`, `private`, `trash`
- Plugin paths use the format `plugin-folder/plugin-file` (e.g. `akismet/akismet`)
- Pagination info is in response headers: `X-WP-Total` and `X-WP-TotalPages`
