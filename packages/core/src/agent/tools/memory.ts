import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";

const CORTASK_DIR = ".cortask";

function getMemoryPath(
  scope: string,
  context: ToolExecutionContext,
): string {
  if (scope === "global") {
    return path.join(context.dataDir, "memory.md");
  }
  return path.join(context.workspacePath, CORTASK_DIR, "memory.md");
}

export const memoryReadTool: ToolHandler = {
  definition: {
    name: "memory_read",
    description:
      "Read long-term memory. Use scope 'global' for user preferences that apply across all projects, or 'project' (default) for project-specific context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        scope: {
          type: "string",
          enum: ["project", "global"],
          description:
            "Which memory to read: 'project' for this workspace, 'global' for cross-project preferences.",
        },
      },
    },
  },
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const scope = (args.scope as string) || "project";
    const memoryPath = getMemoryPath(scope, context);
    try {
      const content = await fs.readFile(memoryPath, "utf-8");
      return { toolCallId: "", content };
    } catch {
      return {
        toolCallId: "",
        content: `No ${scope} memory file found.`,
      };
    }
  },
};

export const memorySaveTool: ToolHandler = {
  definition: {
    name: "memory_save",
    description:
      "Save or replace long-term memory. Use scope 'global' for user preferences (e.g. coding style, preferred tools) that apply across all projects, or 'project' (default) for project-specific context (e.g. architecture decisions, tech stack).",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description:
            "The full content to write to memory.md (markdown format). This replaces the entire file.",
        },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description:
            "Which memory to save: 'project' for this workspace, 'global' for cross-project preferences.",
        },
      },
      required: ["content"],
    },
  },
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const content = args.content as string;
    if (!content) {
      return {
        toolCallId: "",
        content: "Error: content is required",
        isError: true,
      };
    }

    const scope = (args.scope as string) || "project";
    const memoryPath = getMemoryPath(scope, context);
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    await fs.writeFile(memoryPath, content, "utf-8");

    // Also index into structured memory DB if available
    if (context.memoryManager && scope === "project") {
      try {
        await context.memoryManager.index([
          {
            id: crypto.randomUUID(),
            content,
            source: "agent",
            sessionId: context.sessionId,
            createdAt: new Date().toISOString(),
            metadata: { tool: "memory_save" },
          },
        ]);
      } catch {
        // DB indexing failed, file save succeeded — not critical
      }
    }

    return {
      toolCallId: "",
      content: `${scope === "global" ? "Global" : "Project"} memory saved (${content.length} chars)`,
    };
  },
};

export const memoryAppendTool: ToolHandler = {
  definition: {
    name: "memory_append",
    description:
      "Append a note to long-term memory. Use scope 'global' for user preferences that apply across all projects, or 'project' (default) for project-specific context. The note is also indexed in the searchable memory database.",
    inputSchema: {
      type: "object" as const,
      properties: {
        note: {
          type: "string",
          description: "The note to append to memory.md",
        },
        scope: {
          type: "string",
          enum: ["project", "global"],
          description:
            "Which memory to append to: 'project' for this workspace, 'global' for cross-project preferences.",
        },
      },
      required: ["note"],
    },
  },
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const note = args.note as string;
    if (!note) {
      return {
        toolCallId: "",
        content: "Error: note is required",
        isError: true,
      };
    }

    const scope = (args.scope as string) || "project";
    const memoryPath = getMemoryPath(scope, context);
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });

    let existing = "";
    try {
      existing = await fs.readFile(memoryPath, "utf-8");
    } catch {
      existing = scope === "global"
        ? "# Global Memory\n\nUser preferences and context that apply across all projects.\n"
        : "# Project Memory\n\nThis file is used by Cortask to remember important context about this project.\n";
    }

    const updated = existing.trimEnd() + "\n\n" + note + "\n";
    await fs.writeFile(memoryPath, updated, "utf-8");

    // Also index into structured memory DB if available
    if (context.memoryManager && scope === "project") {
      try {
        await context.memoryManager.index([
          {
            id: crypto.randomUUID(),
            content: note,
            source: "agent",
            sessionId: context.sessionId,
            createdAt: new Date().toISOString(),
            metadata: { tool: "memory_append" },
          },
        ]);
      } catch {
        // DB indexing failed, file append succeeded — not critical
      }
    }

    return {
      toolCallId: "",
      content: `Note appended to ${scope} memory.`,
    };
  },
};

export const memorySearchTool: ToolHandler = {
  definition: {
    name: "memory_search",
    description:
      "Search long-term memory using semantic and keyword search. Returns the most relevant memories matching the query. Use this to recall previously saved context, decisions, or notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant memories.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5).",
        },
      },
      required: ["query"],
    },
  },
  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const query = args.query as string;
    if (!query) {
      return {
        toolCallId: "",
        content: "Error: query is required",
        isError: true,
      };
    }

    if (!context.memoryManager) {
      return {
        toolCallId: "",
        content: "Memory search is not available for this workspace.",
      };
    }

    const limit = typeof args.limit === "number" ? args.limit : 5;

    try {
      const results = await context.memoryManager.search(query, limit);
      if (results.length === 0) {
        return {
          toolCallId: "",
          content: "No memories found matching the query.",
        };
      }

      const formatted = results
        .map((r, i) => {
          const date = r.entry.createdAt
            ? new Date(r.entry.createdAt).toLocaleDateString()
            : "unknown";
          return `${i + 1}. [${r.matchType}] (score: ${r.score.toFixed(3)}, ${date})\n${r.entry.content}`;
        })
        .join("\n\n");

      return {
        toolCallId: "",
        content: `Found ${results.length} memories:\n\n${formatted}`,
      };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Memory search error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
