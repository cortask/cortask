import type { ToolHandler } from "../types.js";

const MAX_RESULTS = 5;

export const webSearchTool: ToolHandler = {
  definition: {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo. Returns a list of search results with titles, URLs, and snippets.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        maxResults: {
          type: "number",
          description: `Maximum number of results to return (default ${MAX_RESULTS})`,
        },
      },
      required: ["query"],
    },
  },
  async execute(args) {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || MAX_RESULTS;

    try {
      // Use DuckDuckGo HTML lite (no API key needed)
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        return {
          toolCallId: "",
          content: `Search failed: HTTP ${response.status}`,
          isError: true,
        };
      }

      const html = await response.text();
      const results = parseSearchResults(html, maxResults);

      if (results.length === 0) {
        return { toolCallId: "", content: "No search results found." };
      }

      const formatted = results
        .map(
          (r, i) =>
            `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`,
        )
        .join("\n\n");

      return {
        toolCallId: "",
        content: `Search results for "${query}":\n\n${formatted}`,
      };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Search error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseSearchResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Parse DuckDuckGo HTML lite results
  // Each result is in a <div class="result"> or similar structure
  const resultBlocks = html.split(/class="result\s/);

  for (let i = 1; i < resultBlocks.length && results.length < max; i++) {
    const block = resultBlocks[i];

    // Extract title from <a class="result__a">
    const titleMatch = block.match(
      /class="result__a"[^>]*>([^<]+)/,
    );
    const title = titleMatch?.[1]?.trim() ?? "";

    // Extract URL from href in result__a or result__url
    const urlMatch = block.match(
      /class="result__url"[^>]*>([^<]+)/,
    );
    let url = urlMatch?.[1]?.trim() ?? "";
    if (url && !url.startsWith("http")) {
      url = `https://${url}`;
    }

    // Fallback: extract href from the link
    if (!url) {
      const hrefMatch = block.match(/href="(https?:\/\/[^"]+)"/);
      url = hrefMatch?.[1] ?? "";
    }

    // Extract snippet from <a class="result__snippet">
    const snippetMatch = block.match(
      /class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]+)*)/,
    );
    let snippet = snippetMatch?.[1]?.trim() ?? "";
    // Strip HTML tags from snippet
    snippet = snippet.replace(/<[^>]+>/g, "");

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}
