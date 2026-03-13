# Google Search Console API Guide

Detailed query examples and request body reference.

## Common Queries

### List all properties
```
gsc_list_sites()
```

### Search performance — top queries (last 28 days)
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["query"],"rowLimit":25}'
)
```

### Search performance — top pages
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["page"],"rowLimit":25}'
)
```

### Search performance — by country
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["country"],"rowLimit":10}'
)
```

### Search performance — by device
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["device"]}'
)
```

### Search performance — queries for a specific page
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["query"],"dimensionFilterGroups":[{"filters":[{"dimension":"page","expression":"https://example.com/blog/my-post"}]}],"rowLimit":25}'
)
```

### Search performance — by date (trend)
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["date"]}'
)
```

### Multi-dimension: query + page
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["query","page"],"rowLimit":25}'
)
```

### Filter by search type (web, image, video, news, discover, googleNews)
```
gsc_search_analytics(
  siteUrl: "sc-domain%3Aexample.com",
  body: '{"startDate":"2026-01-01","endDate":"2026-01-28","dimensions":["query"],"type":"image","rowLimit":25}'
)
```

### Inspect a URL
```
gsc_inspect_url(
  body: '{"inspectionUrl":"https://example.com/page","siteUrl":"sc-domain:example.com"}'
)
```

### List sitemaps
```
gsc_list_sitemaps(siteUrl: "sc-domain%3Aexample.com")
```

## Search Analytics Request Body Reference

```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "dimensions": ["query", "page", "country", "device", "date", "searchAppearance"],
  "type": "web",
  "dimensionFilterGroups": [{
    "filters": [{
      "dimension": "query|page|country|device",
      "operator": "contains|equals|notContains|notEquals|includingRegex|excludingRegex",
      "expression": "filter value"
    }]
  }],
  "rowLimit": 25000,
  "startRow": 0,
  "dataState": "all",
  "aggregationType": "auto"
}
```

**Required:** `startDate`, `endDate`
**Max date range:** 16 months, data available from ~3 days ago
**Max rowLimit:** 25,000 (use `startRow` for pagination)
**Dimensions:** up to 3 at once
**`type`:** `web` (default), `image`, `video`, `news`, `discover`, `googleNews`

## Presenting Results

**IMPORTANT: Always present GSC data as formatted markdown tables.** Adapt the tables based on the query dimensions.

### Query Performance Table
| Query | Clicks | Impressions | CTR | Position |
|-------|--------|-------------|-----|----------|
| best widgets | 142 | 3,200 | 4.4% | 8.2 |

### Page Performance Table
| Page | Clicks | Impressions | CTR | Avg Position |
|------|--------|-------------|-----|-------------|
| /blog/widgets-guide | 89 | 1,500 | 5.9% | 6.1 |

### Country Performance Table
| Country | Clicks | Impressions | CTR | Position |
|---------|--------|-------------|-----|----------|
| USA | 500 | 12,000 | 4.2% | 7.8 |

### Date Trend Table
| Date | Clicks | Impressions | CTR | Position |
|------|--------|-------------|-----|----------|
| 2026-01-01 | 45 | 1,200 | 3.8% | 9.1 |

### URL Inspection Summary
| Field | Value |
|-------|-------|
| Indexing state | Indexed |
| Crawl status | Crawled |
| Last crawl | 2026-01-15 |
| Mobile usability | No issues |
| Rich results | FAQ detected |

**Format CTR as percentages (e.g. 4.2%). Round position to 1 decimal. Use thousands separators for large numbers. Show top 20 rows and summarize the rest.**
