---
name: google-search-console
description: "Query Google Search Console: search performance (clicks, impressions, CTR, position), URL inspection, sitemaps. Use when the user asks about their site's SEO performance in Google, indexing status, or search visibility. Do NOT use for keyword research or backlinks (use dataforseo) or site crawling (use screaming-frog)."
tools:
    - name: gsc_list_sites
      description: "List all verified properties in Google Search Console"
      input: {}
      request:
          url: "https://www.googleapis.com/webmasters/v3/sites"
          method: "GET"
          headers:
              Authorization: "Bearer {{oauth2:accessToken}}"
              Accept: "application/json"

    - name: gsc_search_analytics
      description: "Query search performance data (clicks, impressions, CTR, position). The body must be a JSON string with startDate, endDate, dimensions, and optional filters/rowLimit."
      input:
          siteUrl:
              type: string
              description: "URL-encoded site URL. Domain property: sc-domain%3Aexample.com — URL-prefix property: https%3A%2F%2Fwww.example.com%2F"
          body:
              type: string
              description: "JSON request body for the search analytics query"
      request:
          url: "https://www.googleapis.com/webmasters/v3/sites/{{siteUrl}}/searchAnalytics/query"
          method: "POST"
          headers:
              Authorization: "Bearer {{oauth2:accessToken}}"
              Content-Type: "application/json"
              Accept: "application/json"
          body: "{{body}}"

    - name: gsc_list_sitemaps
      description: "List all sitemaps submitted for a site"
      input:
          siteUrl:
              type: string
              description: "URL-encoded site URL (e.g. sc-domain%3Aexample.com)"
      request:
          url: "https://www.googleapis.com/webmasters/v3/sites/{{siteUrl}}/sitemaps"
          method: "GET"
          headers:
              Authorization: "Bearer {{oauth2:accessToken}}"
              Accept: "application/json"

    - name: gsc_inspect_url
      description: "Inspect a URL for indexing status, crawl info, mobile usability, and rich results"
      input:
          body:
              type: string
              description: "JSON body with inspectionUrl and siteUrl fields"
      request:
          url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"
          method: "POST"
          headers:
              Authorization: "Bearer {{oauth2:accessToken}}"
              Content-Type: "application/json"
              Accept: "application/json"
          body: "{{body}}"
metadata:
    emoji: "🔍"
    tags:
        - google
        - seo
        - search-console
        - analytics
    homepage: https://developers.google.com/webmaster-tools
---

# Google Search Console

Query search performance, inspect URLs, and manage sitemaps for your verified Google Search Console properties.

For detailed query examples and request body reference, see `references/api-guide.md`.

## Setup

1. Go to https://console.cloud.google.com
2. Create a project (or select existing)
3. Enable the **Google Search Console API** (APIs & Services → Library → search "Search Console API")
4. Create OAuth 2.0 credentials (APIs & Services → Credentials → Create Credentials → OAuth client ID)
    - Application type: **Web application**
    - Authorized redirect URI: `http://localhost:4280/api/skills/google-search-console/oauth2/callback` (adjust port to match your gateway)
5. In Cortask UI → Skills → google-search-console:
    - Enter the Client ID and Client Secret
    - Click **Connect** to authorize with your Google account

## Site URL Encoding

GSC API requires the site URL to be **URL-encoded** in the path:

| Property type   | Raw value                  | URL-encoded for API                |
| --------------- | -------------------------- | ---------------------------------- |
| Domain property | `sc-domain:example.com`    | `sc-domain%3Aexample.com`          |
| URL prefix      | `https://www.example.com/` | `https%3A%2F%2Fwww.example.com%2F` |

Always URL-encode the `siteUrl` parameter.

## Quick Examples

### List all properties

```
gsc_list_sites()
```

### Top queries (last 28 days)

```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["query"],"rowLimit":25}'
)
```

### Top pages

```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["page"],"rowLimit":25}'
)
```

### Inspect a URL

```
gsc_inspect_url(
  body: '{"inspectionUrl":"https://example.com/page","siteUrl":"sc-domain:example.com"}'
)
```

## Presenting Results

**IMPORTANT: Always present GSC data as formatted markdown tables.**

| Query        | Clicks | Impressions | CTR  | Position |
| ------------ | ------ | ----------- | ---- | -------- |
| best widgets | 142    | 3,200       | 4.4% | 8.2      |

**Format CTR as percentages. Round position to 1 decimal. Use thousands separators. Show top 20 rows and summarize the rest.**

## Troubleshooting

### OAuth token expired

If API calls return 401, the token may have expired. Ask the user to reconnect in Cortask UI → Skills → google-search-console → Reconnect.

### No data returned

- GSC data has a ~3 day delay. Recent dates may have no data.
- Verify the siteUrl is correctly URL-encoded and matches a verified property.

### API not enabled

If you get a 403 error, the user needs to enable the Google Search Console API in Google Cloud Console.
