import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler } from "../types.js";

export const listFilesTool: ToolHandler = {
  definition: {
    name: "list_files",
    description:
      "List files and directories. Path is relative to the workspace root. Returns names with type indicators.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to workspace root (default: root)",
        },
      },
    },
  },
  async execute(args, context) {
    const dirPath = path.resolve(
      context.workspacePath,
      (args.path as string) || ".",
    );

    if (!dirPath.startsWith(context.workspacePath)) {
      return {
        toolCallId: "",
        content: "Error: Cannot list files outside the workspace",
        isError: true,
      };
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((e) => {
        const suffix = e.isDirectory() ? "/" : "";
        return `${e.name}${suffix}`;
      });
      return {
        toolCallId: "",
        content: lines.length > 0 ? lines.join("\n") : "(empty directory)",
      };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
