import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler } from "../types.js";

export const readFileTool: ToolHandler = {
  definition: {
    name: "read_file",
    description:
      "Read the contents of a file. Path is relative to the workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace root",
        },
      },
      required: ["path"],
    },
  },
  async execute(args, context) {
    const filePath = path.resolve(context.workspacePath, args.path as string);

    // Ensure file is within workspace
    if (!filePath.startsWith(context.workspacePath)) {
      return {
        toolCallId: "",
        content: "Error: Cannot read files outside the workspace",
        isError: true,
      };
    }

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { toolCallId: "", content };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
