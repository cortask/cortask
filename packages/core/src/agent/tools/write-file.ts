import fs from "node:fs/promises";
import path from "node:path";
import type { ToolHandler } from "../types.js";

export const writeFileTool: ToolHandler = {
  definition: {
    name: "write_file",
    description:
      "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Path is relative to workspace root. Requires user permission.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace root",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  async execute(args, context) {
    const filePath = path.resolve(context.workspacePath, args.path as string);

    if (!filePath.startsWith(context.workspacePath)) {
      return {
        toolCallId: "",
        content: "Error: Cannot write files outside the workspace",
        isError: true,
      };
    }

    const approved = await context.requestPermission({
      id: `write_${Date.now()}`,
      type: "file_write",
      description: `Write to file: ${args.path}`,
      details: `${(args.content as string).length} characters`,
    });

    if (!approved) {
      return {
        toolCallId: "",
        content: "Permission denied: user rejected file write",
        isError: true,
      };
    }

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, args.content as string, "utf-8");
      return {
        toolCallId: "",
        content: `File written: ${args.path}`,
      };
    } catch (err) {
      return {
        toolCallId: "",
        content: `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};
