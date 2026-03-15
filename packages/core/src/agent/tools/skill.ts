import fs from "node:fs/promises";
import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import { createSkill, updateSkill, readSkillFile, validateSkillName } from "../../skills/writer.js";
import { removeSkill } from "../../skills/installer.js";

/**
 * Creates a skill management tool bound to the user skills directory.
 */
export function createSkillTool(
  userSkillsDir: string,
  bundledSkillNames: string[],
): ToolHandler {
  const bundledNames = new Set(bundledSkillNames);

  return {
    definition: {
      name: "cortask_skill",
      description:
        'Manage custom skills. To create: set action="create", name, and content (full SKILL.md with YAML frontmatter + markdown). To update: action="update" with name and content. To list: action="list". To remove: action="remove" and name.',
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The action to perform",
            enum: ["create", "update", "list", "remove"],
          },
          name: {
            type: "string",
            description: "Skill name in kebab-case (for create/update/remove)",
          },
          content: {
            type: "string",
            description:
              "Full SKILL.md content including YAML frontmatter and markdown body (for create/update)",
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
        switch (action) {
          case "create": {
            const name = args.name as string;
            const content = args.content as string;
            if (!name || !content) {
              return {
                toolCallId: "",
                content: "name and content are required for create",
                isError: true,
              };
            }

            const nameErr = validateSkillName(name);
            if (nameErr) {
              return { toolCallId: "", content: nameErr, isError: true };
            }

            if (bundledNames.has(name)) {
              return {
                toolCallId: "",
                content: `Cannot create skill "${name}" — a built-in skill with that name already exists. Choose a different name.`,
                isError: true,
              };
            }

            const result = await createSkill(userSkillsDir, name, content);
            return {
              toolCallId: "",
              content: `Custom skill "${result.name}" created at ${result.path}. It will be available in the next conversation.`,
            };
          }

          case "update": {
            const name = args.name as string;
            const content = args.content as string;
            if (!name || !content) {
              return {
                toolCallId: "",
                content: "name and content are required for update",
                isError: true,
              };
            }

            await updateSkill(userSkillsDir, name, content);
            return {
              toolCallId: "",
              content: `Custom skill "${name}" updated. Changes will take effect in the next conversation.`,
            };
          }

          case "list": {
            try {
              const entries = await fs.readdir(userSkillsDir, {
                withFileTypes: true,
              });
              const dirs = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name);

              if (dirs.length === 0) {
                return {
                  toolCallId: "",
                  content: "No custom skills found.",
                };
              }

              return {
                toolCallId: "",
                content: `Custom skills:\n${dirs.map((d) => `- ${d}`).join("\n")}`,
              };
            } catch {
              return {
                toolCallId: "",
                content: "No custom skills found.",
              };
            }
          }

          case "remove": {
            const name = args.name as string;
            if (!name) {
              return {
                toolCallId: "",
                content: "name is required for remove",
                isError: true,
              };
            }

            await removeSkill(name, userSkillsDir);
            return {
              toolCallId: "",
              content: `Custom skill "${name}" removed.`,
            };
          }

          default:
            return {
              toolCallId: "",
              content: `Unknown action: ${action}`,
              isError: true,
            };
        }
      } catch (err) {
        return {
          toolCallId: "",
          content: `Skill error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }
    },
  };
}
