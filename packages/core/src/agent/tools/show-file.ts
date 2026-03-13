import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler } from "../types.js";

export const showFileTool: ToolHandler = {
  definition: {
    name: "show_file",
    description:
      "Present a file to the user as a downloadable card in the chat. Use this after creating or processing a file that the user would want to download (e.g. generated documents, images, exports). Path is relative to workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace root",
        },
        label: {
          type: "string",
          description: "Optional display label for the file card",
        },
      },
      required: ["path"],
    },
  },
  async execute(args, context) {
    const filePath = path.resolve(context.workspacePath, args.path as string);

    if (!filePath.startsWith(context.workspacePath)) {
      return {
        toolCallId: "",
        content: "Error: Cannot access files outside the workspace",
        isError: true,
      };
    }

    try {
      const stat = await fs.stat(filePath);
      return {
        toolCallId: "",
        content: JSON.stringify({
          __fileRef: true,
          path: args.path as string,
          size: stat.size,
          label: (args.label as string) || undefined,
        }),
      };
    } catch {
      return {
        toolCallId: "",
        content: `Error: File not found — ${args.path}`,
        isError: true,
      };
    }
  },
};
