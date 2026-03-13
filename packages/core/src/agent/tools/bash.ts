import { exec } from "node:child_process";
import type { ToolHandler } from "../types.js";

const MAX_OUTPUT = 50_000;

export const bashTool: ToolHandler = {
  definition: {
    name: "bash",
    description:
      "Execute a shell command in the workspace directory. Requires user permission. Output is captured and returned.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    },
  },
  async execute(args, context) {
    const command = args.command as string;

    const approved = await context.requestPermission({
      id: `bash_${Date.now()}`,
      type: "bash",
      description: `Execute command: ${command}`,
    });

    if (!approved) {
      return {
        toolCallId: "",
        content: "Permission denied: user rejected command execution",
        isError: true,
      };
    }

    return new Promise((resolve) => {
      exec(
        command,
        {
          cwd: context.workspacePath,
          timeout: 120_000,
          maxBuffer: 1024 * 1024 * 10,
          shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
        },
        (error, stdout, stderr) => {
          let output = "";
          if (stdout) output += stdout;
          if (stderr) output += (output ? "\n" : "") + `STDERR: ${stderr}`;
          if (error && !stderr) {
            output += (output ? "\n" : "") + `Error: ${error.message}`;
          }

          if (output.length > MAX_OUTPUT) {
            output = output.slice(0, MAX_OUTPUT) + "\n...(truncated)";
          }

          resolve({
            toolCallId: "",
            content: output || "(no output)",
            isError: !!error,
          });
        },
      );
    });
  },
};
