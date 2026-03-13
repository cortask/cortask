import crypto from "node:crypto";
import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import type { AgentRunner } from "../runner.js";
import {
  registerSubagentRun,
  completeSubagentRun,
  countActiveChildren,
  getDepthForSession,
  getSubagentRun,
  cancelSubagentRun,
  SUBAGENT_DEFAULTS,
  type SubagentRunRecord,
} from "../subagent/index.js";
import { logger } from "../../logging/logger.js";

// Lazy reference to AgentRunner to avoid circular dependency
let runnerRef: AgentRunner | null = null;

/**
 * Set the AgentRunner reference for subagent spawning.
 * Must be called after AgentRunner instantiation.
 */
export function setSubagentRunner(runner: AgentRunner): void {
  runnerRef = runner;
}

/**
 * Create the subagent tool handler.
 * Factory pattern to allow runtime injection of dependencies.
 */
export function createSubagentTool(): ToolHandler {
  return {
    definition: {
      name: "subagent",
      description:
        "Spawn a sub-agent to handle an independent subtask. The sub-agent runs in isolation and returns its result directly. Use for delegating research, analysis, or parallel tasks to save context. The tool waits for the subagent to complete and returns the result. Simply provide the task description.",
      inputSchema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description:
              "Clear description of the task for the sub-agent",
          },
        },
        required: ["task"],
      },
    },

    execute: async (
      args: Record<string, unknown>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> => {
      return executeSpawn(args, context);
    },
  };
}

/**
 * Execute the spawn action - create and run a subagent.
 */
async function executeSpawn(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const task = args.task as string;
  if (!task?.trim()) {
    return {
      toolCallId: "",
      content: "Error: task is required for spawn action",
      isError: true,
    };
  }

  if (!runnerRef) {
    return {
      toolCallId: "",
      content:
        "Error: Subagent spawning not available - runner not initialized. This is a system error.",
      isError: true,
    };
  }

  // Check depth limit
  const currentDepth = getDepthForSession(context.sessionId);
  if (currentDepth >= SUBAGENT_DEFAULTS.maxDepth) {
    return {
      toolCallId: "",
      content: `Error: Maximum subagent depth reached (${currentDepth}/${SUBAGENT_DEFAULTS.maxDepth}). Cannot spawn deeper subagents. Consider completing this task directly or restructuring your approach.`,
      isError: true,
    };
  }

  // Check concurrency limit
  const activeChildren = countActiveChildren(context.sessionId);
  if (activeChildren >= SUBAGENT_DEFAULTS.maxChildrenPerAgent) {
    return {
      toolCallId: "",
      content: `Error: Maximum concurrent subagents reached (${activeChildren}/${SUBAGENT_DEFAULTS.maxChildrenPerAgent}). Wait for existing subagents to complete before spawning more.`,
      isError: true,
    };
  }

  const childRunId = crypto.randomUUID();
  const childSessionId = `subagent:${childRunId}`;

  // Create AbortController for cancellation support
  const abortController = new AbortController();

  // Register the subagent run
  const record: SubagentRunRecord = {
    runId: childRunId,
    childSessionId,
    parentSessionId: context.sessionId,
    parentRunId: context.runId,
    task,
    depth: currentDepth + 1,
    status: "running",
    createdAt: Date.now(),
    abortController,
  };
  registerSubagentRun(record);

  logger.info(
    `Subagent spawned: ${childRunId} (depth ${record.depth}) for parent ${context.sessionId}`,
    "agent",
  );

  // Capture runner reference for async function
  const runner = runnerRef;

  // Async execution function
  const runSubagent = async () => {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Subagent timeout after 2 minutes")),
          SUBAGENT_DEFAULTS.timeoutMs,
        );
      });

      // Run subagent with race against timeout
      const result = await Promise.race([
        runner.run({
          prompt: `[Subagent Task] You are a subagent helping with a specific subtask. Complete this task concisely and provide a clear result.\n\nTask: ${task}`,
          sessionId: childSessionId,
          signal: abortController.signal,
        }),
        timeoutPromise,
      ]);

      // Mark as complete
      completeSubagentRun(childRunId, "done", result.response);

      logger.info(`Subagent completed: ${childRunId}`, "agent");

      return { success: true, result: result.response, usage: result.usage };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMsg.includes("timeout");
      const isCancelled = abortController.signal.aborted;

      completeSubagentRun(
        childRunId,
        isCancelled ? "cancelled" : isTimeout ? "timeout" : "error",
        undefined,
        errorMsg,
      );

      logger.error(`Subagent failed: ${childRunId} - ${errorMsg}`, "agent");

      return { success: false, error: errorMsg, isTimeout, isCancelled };
    }
  };

  // Wait for completion and return result directly
  const outcome = await runSubagent();

  if (!outcome.success) {
    return {
      toolCallId: "",
      content: `Subagent failed: ${outcome.error}`,
      isError: true,
    };
  }

  // Return the subagent's result directly to the parent agent
  return {
    toolCallId: "",
    content: outcome.result || "Subagent completed with no output.",
  };
}

/**
 * Execute the status action - check subagent status.
 */
function executeStatus(args: Record<string, unknown>): ToolResult {
  const runId = args.runId as string;
  if (!runId?.trim()) {
    return {
      toolCallId: "",
      content: JSON.stringify({ error: "runId is required for status action" }),
      isError: true,
    };
  }

  const record = getSubagentRun(runId);
  if (!record) {
    return {
      toolCallId: "",
      content: JSON.stringify({
        error: `Subagent run "${runId}" not found. It may have completed and been cleaned up.`,
      }),
      isError: true,
    };
  }

  return {
    toolCallId: "",
    content: JSON.stringify({
      runId: record.runId,
      task: record.task,
      status: record.status,
      depth: record.depth,
      result: record.result,
      error: record.error,
      createdAt: new Date(record.createdAt).toISOString(),
      endedAt: record.endedAt
        ? new Date(record.endedAt).toISOString()
        : undefined,
    }),
  };
}

/**
 * Execute the cancel action - cancel a running subagent.
 */
function executeCancel(args: Record<string, unknown>): ToolResult {
  const runId = args.runId as string;
  if (!runId?.trim()) {
    return {
      toolCallId: "",
      content: JSON.stringify({ error: "runId is required for cancel action" }),
      isError: true,
    };
  }

  const record = getSubagentRun(runId);
  if (!record) {
    return {
      toolCallId: "",
      content: JSON.stringify({
        error: `Subagent run "${runId}" not found. It may have already completed.`,
      }),
      isError: true,
    };
  }

  if (record.status !== "running") {
    return {
      toolCallId: "",
      content: JSON.stringify({
        error: `Subagent "${runId}" is not running (status: ${record.status}). Cannot cancel.`,
      }),
      isError: true,
    };
  }

  const cancelled = cancelSubagentRun(runId);

  if (cancelled) {
    logger.info(`Subagent cancelled: ${runId}`, "agent");
    return {
      toolCallId: "",
      content: JSON.stringify({
        success: true,
        runId,
        message: "Subagent cancelled successfully.",
      }),
    };
  } else {
    return {
      toolCallId: "",
      content: JSON.stringify({
        error: `Failed to cancel subagent "${runId}".`,
      }),
      isError: true,
    };
  }
}
