import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import type { ArtifactStore, Artifact } from "../../artifacts/store.js";

/**
 * Creates an artifact tool handler bound to an ArtifactStore instance.
 */
export function createArtifactTool(artifactStore: ArtifactStore): ToolHandler {
  return {
    definition: {
      name: "artifact",
      description:
        "Create rich artifacts (HTML, CSV, SVG, JSON) that will be rendered inline in the chat. Use this for tables, charts, interactive content, and structured data. You can either provide the content directly OR reference a file path to read from disk (preferred when the file already exists).",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "The artifact type",
            enum: ["html", "csv", "json", "svg", "text"],
          },
          title: {
            type: "string",
            description: "A short title for the artifact",
          },
          content: {
            type: "string",
            description:
              "The artifact content (HTML, CSV, JSON, SVG, or plain text). Not needed if path is provided.",
          },
          path: {
            type: "string",
            description:
              "File path relative to workspace root. When provided, content is read from the file instead of the content parameter. Preferred when showing an existing file inline.",
          },
        },
        required: ["type", "title"],
      },
    },

    execute: async (
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> => {
      const type = args.type as Artifact["type"];
      const title = args.title as string;
      const filePath = args.path as string | undefined;
      let content = args.content as string | undefined;

      if (!type || !title) {
        return {
          toolCallId: "",
          content: "type and title are required",
          isError: true,
        };
      }

      // Read content from file if path is provided
      if (filePath) {
        const resolved = path.resolve(context.workspacePath, filePath);
        if (!resolved.startsWith(context.workspacePath)) {
          return {
            toolCallId: "",
            content: "Error: Cannot access files outside the workspace",
            isError: true,
          };
        }
        try {
          content = await fs.readFile(resolved, "utf-8");
        } catch {
          return {
            toolCallId: "",
            content: `Error: File not found — ${filePath}`,
            isError: true,
          };
        }
      }

      if (!content) {
        return {
          toolCallId: "",
          content: "Either content or path must be provided",
          isError: true,
        };
      }

      try {
        const artifact = artifactStore.create(type, title, content);
        return {
          toolCallId: "",
          content: JSON.stringify({
            artifactId: artifact.id,
            type: artifact.type,
            title: artifact.title,
            mimeType: artifact.mimeType,
          }),
        };
      } catch (err) {
        return {
          toolCallId: "",
          content: `Artifact error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }
    },
  };
}
