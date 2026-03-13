---
name: dataforseo
description: "Search engine data via DataForSEO API: Google SERP results, keyword search volume, keyword suggestions, backlink analysis, and on-page SEO audits. Use when the user asks about search rankings, keyword research, backlinks, or on-page SEO analysis. Do NOT use for Google Search Console data or site crawling."
metadata:
  emoji: "📊"
  tags:
    - seo
    - serp
    - keywords
    - backlinks
    - dataforseo
  homepage: https://dataforseo.com
---

# DataForSEO

Query search engine data: SERP results, keyword volumes, keyword ideas, backlink profiles, and on-page SEO analysis.

## When to Use

- "Check Google rankings for 'best seo tools'"
- "Get search volume for these keywords"
- "Find keyword suggestions for 'content marketing'"
- "Show backlink summary for example.com"
- "List backlinks pointing to competitor.com"
- "Analyze on-page SEO for this URL"

## Tools

### dfs_serp_google
Google organic SERP results for a keyword. Returns ranked URLs with titles, snippets, and positions.

```
dfs_serp_google(keyword: "best seo tools")
dfs_serp_google(keyword: "restaurants near me", location_code: 1006886, device: "mobile")
```

### dfs_keyword_search_volume
Monthly search volume and CPC data for one or more keywords.

```
dfs_keyword_search_volume(keywords: "seo tools, keyword research, backlink checker")
```

### dfs_keyword_suggestions
Generate keyword ideas from seed keywords. Returns related keywords with volume and competition.

```
dfs_keyword_suggestions(keywords: "content marketing", limit: 30)
```

### dfs_backlinks_summary
Backlink profile overview for a domain or URL: total backlinks, referring domains, domain rank.

```
dfs_backlinks_summary(target: "example.com")
```

### dfs_backlinks
List individual backlinks pointing to a target domain or URL.

```
dfs_backlinks(target: "example.com", limit: 50, mode: "one_per_domain")
```

### dfs_onpage_instant
On-page SEO analysis for a single URL: meta tags, headings, images, links, page speed metrics.

```
dfs_onpage_instant(url: "https://example.com/blog/post")
```

## Location Codes

Common location codes (full list: https://api.dataforseo.com/v3/serp/google/locations):

| Location | Code |
|----------|------|
| United States | 2840 |
| United Kingdom | 2826 |
| Germany | 2276 |
| France | 2250 |
| Canada | 2124 |
| Australia | 2036 |
| India | 2356 |
| Brazil | 2076 |

## Presenting Results

**IMPORTANT: Always present DataForSEO data as formatted markdown tables.**

### SERP Results
| # | Title | URL | Domain |
|---|-------|-----|--------|
| 1 | Best SEO Tools 2026 | https://example.com/seo-tools | example.com |

### Keyword Search Volume
| Keyword | Volume | CPC | Competition |
|---------|--------|-----|-------------|
| seo tools | 14,800 | $4.50 | High |

### Keyword Suggestions
| Keyword | Volume | CPC | Competition |
|---------|--------|-----|-------------|
| seo audit tool | 2,400 | $3.20 | Medium |

### Backlinks Summary
| Metric | Value |
|--------|-------|
| Total backlinks | 12,543 |
| Referring domains | 892 |
| Domain rank | 45 |

### Backlinks List
| Source URL | Anchor | Domain Rank | First Seen |
|-----------|--------|-------------|------------|
| https://blog.example.com/post | SEO Guide | 35 | 2025-06-15 |

**Use thousands separators for large numbers. Format CPC as currency. Show top results and summarize the rest.**

## Troubleshooting

### 402 or "Insufficient credits"
The DataForSEO account has run out of API credits. The user needs to top up their balance.

### Empty SERP results
Some keywords may return no results for certain locations. Try a different `location_code` or check for typos in the keyword.

### Backlinks returning 0 results
The target domain may be too new or have no indexed backlinks. Try the root domain instead of a specific URL.
