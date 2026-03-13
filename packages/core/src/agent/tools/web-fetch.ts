import type { ToolHandler } from "../types.js";

const MAX_CONTENT = 100_000;

export const webFetchTool: ToolHandler = {
  definition: {
    name: "web_fetch",
    description:
      "Fetch the content of a web page. Returns the text content of the page.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
  async execute(args) {
    const url = args.url as string;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Cortask/0.1 (AI Assistant)",
          Accept: "text/html,application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        return {
          toolCallId: "",
          content: `HTTP ${response.status}: ${response.statusText}`,
          isError: true,
        };
      }

      let content = await response.text();
      if (content.length > MAX_CONTENT) {
        content = content.slice(0, MAX_CONTENT) + "\n...(truncated)";
      }

      return { toolCallId: "", content };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
