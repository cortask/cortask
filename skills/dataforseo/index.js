// DataForSEO API skill — Tier 3 code tools
// Uses Basic HTTP Auth (base64-encoded login:password)

const BASE_URL = "https://api.dataforseo.com/v3";
const MAX_RESPONSE_CHARS = 50_000;

async function dfsRequest(endpoint, body, credentialStore, skillName) {
  const login = await credentialStore.get(`skill.${skillName}.login`);
  const password = await credentialStore.get(`skill.${skillName}.password`);
  if (!login || !password) {
    return { content: "DataForSEO credentials not configured. Set login and password in Skills → dataforseo.", isError: true };
  }

  const token = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });

  let text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    text = text.slice(0, MAX_RESPONSE_CHARS) + "\n...(truncated)";
  }

  if (!response.ok) {
    return { content: `HTTP ${response.status} ${response.statusText}\n${text}`, isError: true };
  }

  return { content: text };
}

export const tools = [
  // --- SERP: Google Organic ---
  {
    name: "dfs_serp_google",
    description: "Get Google organic SERP results for a keyword. Returns ranked URLs with titles, snippets, positions.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Search query keyword" },
        location_code: { type: "number", description: "Location code (default: 2840 for US). See https://api.dataforseo.com/v3/serp/google/locations" },
        language_code: { type: "string", description: "Language code (default: en)" },
        device: { type: "string", enum: ["desktop", "mobile"], description: "Device type (default: desktop)" },
        depth: { type: "number", description: "Number of results to return (default: 100)" },
      },
      required: ["keyword"],
    },
    async execute(args, { credentialStore, skillName }) {
      const body = {
        keyword: args.keyword,
        location_code: args.location_code ?? 2840,
        language_code: args.language_code ?? "en",
        device: args.device ?? "desktop",
        depth: args.depth ?? 100,
      };
      return dfsRequest("serp/google/organic/live/advanced", body, credentialStore, skillName);
    },
  },

  // --- Keywords: Search Volume ---
  {
    name: "dfs_keyword_search_volume",
    description: "Get monthly search volume, CPC, and competition data for keywords.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Comma-separated list of keywords (e.g. \"seo tools, keyword research\")" },
        location_code: { type: "number", description: "Location code (default: 2840 for US)" },
        language_code: { type: "string", description: "Language code (default: en)" },
      },
      required: ["keywords"],
    },
    async execute(args, { credentialStore, skillName }) {
      const keywordList = String(args.keywords).split(",").map(k => k.trim()).filter(Boolean);
      if (keywordList.length === 0) {
        return { content: "No keywords provided.", isError: true };
      }
      const body = {
        keywords: keywordList,
        location_code: args.location_code ?? 2840,
        language_code: args.language_code ?? "en",
      };
      return dfsRequest("keywords_data/google_ads/search_volume/live", body, credentialStore, skillName);
    },
  },

  // --- Keywords: Suggestions ---
  {
    name: "dfs_keyword_suggestions",
    description: "Generate keyword ideas from seed keywords. Returns related keywords with search volume and competition.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Comma-separated seed keywords (e.g. \"content marketing\")" },
        location_code: { type: "number", description: "Location code (default: 2840 for US)" },
        language_code: { type: "string", description: "Language code (default: en)" },
        limit: { type: "number", description: "Max number of suggestions to return (default: 50)" },
      },
      required: ["keywords"],
    },
    async execute(args, { credentialStore, skillName }) {
      const keywordList = String(args.keywords).split(",").map(k => k.trim()).filter(Boolean);
      if (keywordList.length === 0) {
        return { content: "No keywords provided.", isError: true };
      }
      const body = {
        keywords: keywordList,
        location_code: args.location_code ?? 2840,
        language_code: args.language_code ?? "en",
        limit: args.limit ?? 50,
      };
      return dfsRequest("keywords_data/google_ads/keywords_for_keywords/live", body, credentialStore, skillName);
    },
  },

  // --- Backlinks: Summary ---
  {
    name: "dfs_backlinks_summary",
    description: "Get backlink profile summary for a domain or URL: total backlinks, referring domains, domain rank.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Domain (e.g. \"example.com\") or full URL to analyze" },
      },
      required: ["target"],
    },
    async execute(args, { credentialStore, skillName }) {
      const body = { target: args.target };
      return dfsRequest("backlinks/summary/live", body, credentialStore, skillName);
    },
  },

  // --- Backlinks: List ---
  {
    name: "dfs_backlinks",
    description: "List individual backlinks pointing to a domain or URL with anchor text, source URL, and domain rank.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Domain (e.g. \"example.com\") or full URL" },
        limit: { type: "number", description: "Max results to return (default: 100)" },
        mode: {
          type: "string",
          enum: ["as_is", "one_per_domain", "one_per_anchor"],
          description: "Grouping mode: as_is (all links), one_per_domain, or one_per_anchor (default: as_is)",
        },
      },
      required: ["target"],
    },
    async execute(args, { credentialStore, skillName }) {
      const body = {
        target: args.target,
        limit: args.limit ?? 100,
        mode: args.mode ?? "as_is",
      };
      return dfsRequest("backlinks/backlinks/live", body, credentialStore, skillName);
    },
  },

  // --- On-Page: Instant Pages ---
  {
    name: "dfs_onpage_instant",
    description: "On-page SEO analysis for a single URL: meta tags, headings, images, links, page speed metrics.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to analyze (e.g. \"https://example.com/page\")" },
        enable_javascript: { type: "boolean", description: "Render JavaScript before analysis (default: false)" },
      },
      required: ["url"],
    },
    async execute(args, { credentialStore, skillName }) {
      const body = {
        url: args.url,
        enable_javascript: args.enable_javascript ?? false,
      };
      return dfsRequest("on_page/instant_pages", body, credentialStore, skillName);
    },
  },
];
