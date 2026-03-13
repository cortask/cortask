import type { WebSocket } from "ws";
import type { WebSocketServer } from "ws";
import { getDefaultModel, type GatewayContext } from "./server.js";
import { logger, type QuestionnaireResponse } from "@cortask/core";

export interface ChannelStatusEvent {
  channelId: string;
  running: boolean;
  authenticated?: boolean;
}

export function broadcastChannelStatus(wss: WebSocketServer, status: ChannelStatusEvent) {
  const data = JSON.stringify({ type: "channel:status", ...status });
  for (const client of wss.clients) {
    if (client.readyState === (client as WebSocket).OPEN) {
      client.send(data);
    }
  }
}

export function broadcastSessionRefresh(wss: WebSocketServer, workspaceId: string) {
  const data = JSON.stringify({ type: "session:refresh", workspaceId });
  for (const client of wss.clients) {
    if (client.readyState === (client as WebSocket).OPEN) {
      client.send(data);
    }
  }
}

interface ChatAttachment {
  mimeType: string;
  base64: string;
  name?: string;
}

interface ChatMessage {
  type: "chat";
  sessionKey: string;
  message: string;
  workspaceId: string;
  attachments?: ChatAttachment[];
}

interface CancelMessage {
  type: "cancel";
  sessionKey: string;
}

interface PermissionResponse {
  type: "permission_response";
  requestId: string;
  approved: boolean;
}

interface QuestionnaireResponseMessage {
  type: "questionnaire_response";
  requestId: string;
  responses: QuestionnaireResponse;
}

type IncomingMessage =
  | ChatMessage
  | CancelMessage
  | PermissionResponse
  | QuestionnaireResponseMessage;

// Pending permission requests: requestId → resolve callback
const pendingPermissions = new Map<string, (approved: boolean) => void>();

// Pending questionnaire requests: requestId → resolve callback
const pendingQuestionnaires = new Map<
  string,
  (responses: QuestionnaireResponse) => void
>();

// Active runs: sessionKey → AbortController
const activeRuns = new Map<string, AbortController>();

export function handleWebSocket(ws: WebSocket, ctx: GatewayContext) {
  logger.info("WebSocket client connected", "gateway");

  ws.on("message", async (raw) => {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(raw.toString()) as IncomingMessage;
    } catch {
      sendError(ws, "", "Invalid JSON");
      return;
    }

    if (msg.type === "chat") {
      await handleChat(ws, msg, ctx);
    } else if (msg.type === "cancel") {
      logger.info(`Cancel requested for session ${msg.sessionKey}`, "gateway");
      const controller = activeRuns.get(msg.sessionKey);
      if (controller) {
        controller.abort();
        activeRuns.delete(msg.sessionKey);
      }
    } else if (msg.type === "permission_response") {
      const resolver = pendingPermissions.get(msg.requestId);
      if (resolver) {
        resolver(msg.approved);
        pendingPermissions.delete(msg.requestId);
      }
    } else if (msg.type === "questionnaire_response") {
      const resolver = pendingQuestionnaires.get(msg.requestId);
      if (resolver) {
        resolver(msg.responses);
        pendingQuestionnaires.delete(msg.requestId);
      }
    }
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected", "gateway");
    // Abort all active runs when client disconnects
    for (const [id, controller] of activeRuns) {
      controller.abort();
      activeRuns.delete(id);
    }
    // Deny all pending permissions when client disconnects
    for (const [id, resolver] of pendingPermissions) {
      resolver(false);
      pendingPermissions.delete(id);
    }
    // Don't resolve pending questionnaires on disconnect — the user may
    // reconnect and submit. They will time out on their own if abandoned.
  });
}

function checkSpendingLimit(ctx: GatewayContext): string | null {
  const { spending } = ctx.config;
  if (!spending.enabled) return null;

  const summary = ctx.usageStore.getSummary(spending.period);

  if (spending.maxTokens && summary.totalTokens >= spending.maxTokens) {
    return `Spending limit reached: ${summary.totalTokens.toLocaleString()} / ${spending.maxTokens.toLocaleString()} tokens (${spending.period})`;
  }
  if (spending.maxCostUsd && summary.totalCostUsd >= spending.maxCostUsd) {
    return `Spending limit reached: $${summary.totalCostUsd.toFixed(2)} / $${spending.maxCostUsd.toFixed(2)} (${spending.period})`;
  }
  return null;
}

async function handleChat(
  ws: WebSocket,
  msg: ChatMessage,
  ctx: GatewayContext,
) {
  // Create abort controller for this run
  const abortController = new AbortController();
  activeRuns.set(msg.sessionKey, abortController);

  try {
    // Check spending limits before running
    const limitError = checkSpendingLimit(ctx);
    if (limitError) {
      sendError(ws, msg.sessionKey, limitError);
      return;
    }

    const workspace = await ctx.workspaceManager.get(msg.workspaceId);
    if (!workspace) {
      sendError(ws, msg.sessionKey, "Workspace not found");
      return;
    }

    const runner = await ctx.createAgentRunner(workspace.rootPath, {
      onPermissionRequest: async (req) => {
        return new Promise<boolean>((resolve) => {
          pendingPermissions.set(req.id, resolve);
          send(ws, {
            type: "permission_request",
            requestId: req.id,
            description: req.description,
            details: req.details,
          });

          // Auto-deny after 60 seconds
          setTimeout(() => {
            if (pendingPermissions.has(req.id)) {
              pendingPermissions.delete(req.id);
              resolve(false);
            }
          }, 60000);
        });
      },
      onQuestionnaireRequest: async (req) => {
        return new Promise<QuestionnaireResponse>((resolve) => {
          pendingQuestionnaires.set(req.id, resolve);
          send(ws, {
            type: "questionnaire_request",
            requestId: req.id,
            data: {
              title: req.title,
              description: req.description,
              questions: req.questions,
            },
          });

        });
      },
    });

    for await (const event of runner.runStream({
      prompt: msg.message,
      attachments: msg.attachments,
      sessionId: msg.sessionKey,
      workspaceId: msg.workspaceId,
      signal: abortController.signal,
    })) {
      if (ws.readyState !== ws.OPEN || abortController.signal.aborted) break;

      switch (event.type) {
        case "thinking_delta":
          send(ws, {
            type: "thinking_delta",
            sessionKey: msg.sessionKey,
            text: event.text,
          });
          break;
        case "text_delta":
          send(ws, {
            type: "text_delta",
            sessionKey: msg.sessionKey,
            text: event.text,
          });
          break;
        case "tool_call_start":
          send(ws, {
            type: "tool_call_start",
            sessionKey: msg.sessionKey,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
          });
          break;
        case "tool_result":
          send(ws, {
            type: "tool_result",
            sessionKey: msg.sessionKey,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            toolArgs: event.toolArgs,
            content: event.toolResult?.content,
            isError: event.toolResult?.isError,
          });
          break;
        case "done":
          // Record usage for spending tracking
          if (event.usage) {
            try {
              const providerId = ctx.config.providers.default || "anthropic";
              const providerConfig = ctx.config.providers[providerId as keyof typeof ctx.config.providers];
              const model = (typeof providerConfig === "object" && providerConfig && "model" in providerConfig ? providerConfig.model : undefined) || getDefaultModel(providerId);
              ctx.usageStore.record(
                providerId,
                model,
                event.usage.inputTokens,
                event.usage.outputTokens,
              );
            } catch (err) {
              logger.error(`Failed to record usage: ${err}`, "gateway");
            }
          }
          send(ws, {
            type: "done",
            sessionKey: msg.sessionKey,
            usage: event.usage,
          });
          break;
        case "error":
          sendError(ws, msg.sessionKey, event.error ?? "Unknown error");
          break;
      }
    }
  } catch (err) {
    // Don't report abort errors as failures
    if (!abortController.signal.aborted) {
      sendError(
        ws,
        msg.sessionKey,
        err instanceof Error ? err.message : String(err),
      );
    }
  } finally {
    activeRuns.delete(msg.sessionKey);
  }
}

function send(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws: WebSocket, sessionKey: string, error: string) {
  send(ws, { type: "error", sessionKey, error });
}
