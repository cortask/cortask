// WordPress REST API skill — Tier 3 code tool
// Uses Basic HTTP Auth (base64-encoded username:appPassword)
// Supports multiple WordPress sites via multi-instance credentials

const MAX_RESPONSE_CHARS = 50_000;
const STORE_PREFIX = "skill.wordpress";

/**
 * Resolve WordPress site credentials.
 * Supports multi-instance (new) and single-instance (legacy) storage.
 */
async function getSiteCredentials(credentialStore, siteId) {
  const registryKey = `${STORE_PREFIX}._instances`;
  const raw = await credentialStore.get(registryKey);
  const instances = raw ? JSON.parse(raw) : [];

  if (instances.length > 0) {
    // Multi-instance mode
    const instance = siteId
      ? instances.find((i) => i.id === siteId || i.label.toLowerCase() === String(siteId).toLowerCase())
      : instances[0];

    if (!instance) {
      const available = instances.map((i) => i.label).join(", ");
      throw new Error(`Site "${siteId}" not found. Available: ${available}`);
    }

    const prefix = `${STORE_PREFIX}.${instance.id}`;
    return {
      id: instance.id,
      label: instance.label,
      siteUrl: await credentialStore.get(`${prefix}.siteUrl`),
      username: await credentialStore.get(`${prefix}.username`),
      appPassword: await credentialStore.get(`${prefix}.appPassword`),
    };
  }

  // Legacy single-instance fallback
  return {
    id: "default",
    label: "Default",
    siteUrl: await credentialStore.get(`${STORE_PREFIX}.siteUrl`),
    username: await credentialStore.get(`${STORE_PREFIX}.username`),
    appPassword: await credentialStore.get(`${STORE_PREFIX}.appPassword`),
  };
}

async function wpRequest(method, url, headers, body) {
  const opts = { method, headers };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, opts);

  let text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    text = text.slice(0, MAX_RESPONSE_CHARS) + "\n...(truncated)";
  }

  // Include pagination headers in response
  const total = response.headers.get("X-WP-Total");
  const totalPages = response.headers.get("X-WP-TotalPages");
  let meta = "";
  if (total || totalPages) {
    meta = `[Total: ${total ?? "?"}, Pages: ${totalPages ?? "?"}]\n`;
  }

  if (!response.ok) {
    return { content: `HTTP ${response.status} ${response.statusText}\n${text}`, isError: true };
  }

  return { content: meta + text };
}

export const tools = [
  {
    name: "list_wordpress_sites",
    description: "List all configured WordPress sites. Call this first to discover available sites.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute(_args, { credentialStore }) {
      const registryKey = `${STORE_PREFIX}._instances`;
      const raw = await credentialStore.get(registryKey);
      const instances = raw ? JSON.parse(raw) : [];

      if (instances.length === 0) {
        // Check legacy single-instance
        const siteUrl = await credentialStore.get(`${STORE_PREFIX}.siteUrl`);
        if (siteUrl) {
          return { content: `Configured WordPress sites:\n- Default (${siteUrl}) [id: default]` };
        }
        return { content: "No WordPress sites configured." };
      }

      const lines = [];
      for (const inst of instances) {
        const siteUrl = await credentialStore.get(`${STORE_PREFIX}.${inst.id}.siteUrl`);
        lines.push(`- ${inst.label} (${siteUrl || "unknown"}) [id: ${inst.id}]`);
      }

      return { content: `Configured WordPress sites:\n${lines.join("\n")}` };
    },
  },
  {
    name: "wordpress_api",
    description: "Make a WordPress REST API call. Use for managing posts, pages, media, plugins, themes, users, comments, categories, tags, and site settings.",
    inputSchema: {
      type: "object",
      properties: {
        site: {
          type: "string",
          description: "Site label or ID. Omit to use the first configured site.",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
          description: "HTTP method",
        },
        path: {
          type: "string",
          description: "API path after /wp-json/, e.g. 'wp/v2/posts', 'wp/v2/pages/123', 'wp/v2/plugins'",
        },
        body: {
          type: "string",
          description: "JSON request body for POST/PUT requests",
        },
        params: {
          type: "string",
          description: "Query parameters, e.g. 'per_page=5&status=draft&_fields=id,title,status'",
        },
      },
      required: ["method", "path"],
    },
    async execute(args, { credentialStore }) {
      const site = await getSiteCredentials(credentialStore, args.site);

      if (!site.siteUrl || !site.username || !site.appPassword) {
        const missing = [];
        if (!site.siteUrl) missing.push("siteUrl");
        if (!site.username) missing.push("username");
        if (!site.appPassword) missing.push("appPassword");
        return {
          content: `WordPress credentials not configured. Missing: ${missing.join(", ")}. Set them in Skills > WordPress.`,
          isError: true,
        };
      }

      // Build URL
      const base = site.siteUrl.replace(/\/+$/, "");
      let url = `${base}/wp-json/${args.path}`;
      if (args.params) {
        url += (url.includes("?") ? "&" : "?") + args.params;
      }

      // Basic Auth
      const token = Buffer.from(`${site.username}:${site.appPassword}`).toString("base64");
      const headers = {
        "Authorization": `Basic ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      return wpRequest(args.method, url, headers, args.body);
    },
  },
];
