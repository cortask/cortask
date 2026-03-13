import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import type { WorkspaceManager } from "../../workspace/manager.js";

/**
 * Creates a switch_workspace tool for channel-based runners.
 * Allows the user to list workspaces or switch to a different one.
 * Switching updates the workspace mapping so the next message uses the new workspace.
 */
export function createSwitchWorkspaceTool(
  workspaceManager: WorkspaceManager,
  chatKey: string,
): ToolHandler {
  return {
    definition: {
      name: "switch_workspace",
      description:
        "Switch the active workspace/project for this chat. Use 'list' to show available workspaces, or 'switch' with a workspace name to change. After switching, a fresh conversation starts in the new workspace context.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The action to perform",
            enum: ["list", "switch"],
          },
          workspace_name: {
            type: "string",
            description: "The name of the workspace to switch to (case-insensitive partial match).",
          },
        },
        required: ["action"],
      },
    },

    execute: async (
      args: Record<string, unknown>,
      _context: ToolExecutionContext,
    ): Promise<ToolResult> => {
      const action = args.action as string;

      try {
        const workspaces = await workspaceManager.list();

        if (action === "list") {
          if (workspaces.length === 0) {
            return { toolCallId: "", content: "No workspaces configured." };
          }
          const currentWsId = workspaceManager.getChannelWorkspace(chatKey);
          const lines = workspaces.map((ws) => {
            const active = ws.id === currentWsId ? " (active)" : "";
            return `- **${ws.name}**${active}`;
          });
          return { toolCallId: "", content: `Available workspaces:\n${lines.join("\n")}` };
        }

        if (action === "switch") {
          const name = args.workspace_name as string;
          if (!name) {
            return { toolCallId: "", content: "workspace_name is required for switch.", isError: true };
          }

          const query = name.toLowerCase();
          const match =
            workspaces.find((ws) => ws.name.toLowerCase() === query) ??
            workspaces.find((ws) => ws.name.toLowerCase().includes(query));

          if (!match) {
            const available = workspaces.map((ws) => ws.name).join(", ");
            return { toolCallId: "", content: `No workspace matching "${name}". Available: ${available}`, isError: true };
          }

          workspaceManager.setChannelWorkspace(chatKey, match.id);
          return { toolCallId: "", content: `Switched to workspace **${match.name}**. The next message will start a fresh conversation in this workspace.` };
        }

        return { toolCallId: "", content: `Unknown action: ${action}. Use "list" or "switch".`, isError: true };
      } catch (err) {
        return { toolCallId: "", content: `Error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
      }
    },
  };
}
