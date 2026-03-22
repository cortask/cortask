import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import type { CronService } from "../../cron/service.js";
import type { CronSchedule, CronDelivery } from "../../cron/types.js";
import { validateCronExpr } from "../../cron/schedule.js";

/**
 * Creates a cron tool handler bound to a CronService instance.
 * This is a factory because the cron service is initialized at runtime.
 */
export function createCronTool(cronService: CronService): ToolHandler {
  return {
    definition: {
      name: "cortask_cron",
      description:
        'Manage scheduled jobs. To create: set action="create", name, schedule_type, schedule_value, and prompt. To list all jobs: set action="list". To remove: set action="remove" and job_id.',
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The action to perform",
            enum: ["list", "create", "update", "remove", "run_now"],
          },
          name: {
            type: "string",
            description: "Job name (for create/update)",
          },
          schedule_type: {
            type: "string",
            description: 'Schedule type: "at" for one-time (ISO datetime), "every" for interval (milliseconds), "cron" for recurring (cron expression)',
            enum: ["at", "every", "cron"],
          },
          schedule_value: {
            type: "string",
            description:
              'The schedule value. Examples: "2026-03-10T10:00:00" for at, "60000" for every, "0 9 * * 1" for cron',
          },
          timezone: {
            type: "string",
            description: "Timezone (e.g. Europe/Berlin)",
          },
          prompt: {
            type: "string",
            description: "The prompt/task to execute when the job runs",
          },
          enabled: {
            type: "boolean",
            description: "Whether the job is enabled",
          },
          delivery_channel: {
            type: "string",
            description:
              'Channel to deliver results to (e.g. "telegram", "discord", "whatsapp")',
          },
          delivery_target: {
            type: "string",
            description: "Target chat/user ID for delivery",
          },
          job_id: {
            type: "string",
            description: "Job ID (for update, remove, run_now)",
          },
        },
        required: ["action"],
      },
    },

    execute: async (
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> => {
      const action = args.action as string;

      try {
        switch (action) {
          case "list": {
            const jobs = cronService.list(context.workspaceId);
            if (jobs.length === 0) {
              return { toolCallId: "", content: "No cron jobs found." };
            }
            const lines = jobs.map((j) => {
              const state = cronService.getState(j.id);
              const nextRun = state?.nextRunAtMs
                ? new Date(state.nextRunAtMs).toISOString()
                : "none";
              const status = j.enabled ? "enabled" : "disabled";
              return `- **${j.name}** (${j.id})\n  Status: ${status} | Next: ${nextRun} | Schedule: ${JSON.stringify(j.schedule)}\n  Prompt: ${j.prompt.slice(0, 100)}`;
            });
            return { toolCallId: "", content: lines.join("\n\n") };
          }

          case "create": {
            const name = args.name as string;
            const prompt = args.prompt as string;
            if (!name || !prompt) {
              return {
                toolCallId: "",
                content: "name and prompt are required for create",
                isError: true,
              };
            }

            const schedule = buildSchedule(args);
            if (typeof schedule === "string") {
              return { toolCallId: "", content: schedule, isError: true };
            }

            const delivery = buildDelivery(args);
            const job = cronService.add({
              name,
              schedule,
              prompt,
              enabled: (args.enabled as boolean) ?? true,
              delivery,
              workspaceId: context.workspaceId,
            });

            return {
              toolCallId: "",
              content: `Cron job created: "${job.name}" (${job.id})\nSchedule: ${JSON.stringify(job.schedule)}`,
            };
          }

          case "update": {
            const jobId = args.job_id as string;
            if (!jobId) {
              return {
                toolCallId: "",
                content: "job_id is required for update",
                isError: true,
              };
            }

            const updates: Record<string, unknown> = {};
            if (args.name) updates.name = args.name;
            if (args.prompt) updates.prompt = args.prompt;
            if (args.enabled !== undefined) updates.enabled = args.enabled;
            if (args.delivery_channel || args.delivery_target) {
              updates.delivery = buildDelivery(args);
            }
            if (args.schedule_type) {
              const schedule = buildSchedule(args);
              if (typeof schedule === "string") {
                return { toolCallId: "", content: schedule, isError: true };
              }
              updates.schedule = schedule;
            }

            const updated = cronService.update(jobId, updates);
            if (!updated) {
              return {
                toolCallId: "",
                content: `Job ${jobId} not found`,
                isError: true,
              };
            }

            return {
              toolCallId: "",
              content: `Job "${updated.name}" updated.`,
            };
          }

          case "remove": {
            const jobId = args.job_id as string;
            if (!jobId) {
              return {
                toolCallId: "",
                content: "job_id is required for remove",
                isError: true,
              };
            }
            const removed = cronService.remove(jobId);
            return {
              toolCallId: "",
              content: removed
                ? `Job ${jobId} removed.`
                : `Job ${jobId} not found.`,
            };
          }

          case "run_now": {
            const jobId = args.job_id as string;
            if (!jobId) {
              return {
                toolCallId: "",
                content: "job_id is required for run_now",
                isError: true,
              };
            }
            await cronService.runNow(jobId);
            return { toolCallId: "", content: `Job ${jobId} executed.` };
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
          content: `Cron error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        };
      }
    },
  };
}

function buildDelivery(args: Record<string, unknown>): CronDelivery {
  return {
    channel: (args.delivery_channel as string) || undefined,
    target: (args.delivery_target as string) || undefined,
  };
}

function buildSchedule(
  args: Record<string, unknown>,
): CronSchedule | string {
  const type = args.schedule_type as string;
  const value = args.schedule_value as string;

  if (!type || !value) {
    return "schedule_type and schedule_value are required";
  }

  switch (type) {
    case "at":
      return { type: "at", datetime: value };
    case "every": {
      const ms = parseInt(value, 10);
      if (isNaN(ms) || ms <= 0) return "schedule_value must be a positive number of milliseconds";
      return { type: "every", intervalMs: ms };
    }
    case "cron": {
      const err = validateCronExpr(value);
      if (err) return `Invalid cron expression: ${err}`;
      return {
        type: "cron",
        expression: value,
        timezone: (args.timezone as string) || undefined,
      };
    }
    default:
      return `Unknown schedule type: ${type}`;
  }
}
