import type { ToolDefinition, ToolCall, ToolResult } from "../providers/types.js";

export interface Attachment {
  mimeType: string;
  base64: string;
  name?: string;
}

export interface AgentRunParams {
  prompt: string;
  attachments?: Attachment[];
  fileReferences?: string[];
  sessionId?: string;
  workspaceId?: string;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  runId: string;
  response: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface PermissionRequest {
  id: string;
  type: "file_write" | "file_delete" | "bash" | "other";
  description: string;
  details?: string;
}

export interface QuestionnaireQuestion {
  id: string;
  question: string;
  type: "single" | "multiple" | "text" | "textarea";
  options?: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  required?: boolean;
  placeholder?: string;
  allowOther?: boolean; // Show "Other" option with text input
}

export interface QuestionnaireRequest {
  id: string;
  title?: string;
  description?: string;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireResponse {
  [questionId: string]: string | string[];
}

export interface AgentStreamEvent {
  type:
    | "thinking_delta"
    | "text_delta"
    | "tool_call_start"
    | "tool_call_delta"
    | "tool_call_end"
    | "tool_result"
    | "permission_request"
    | "questionnaire_request"
    | "done"
    | "error";
  text?: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: ToolResult;
  permissionRequest?: PermissionRequest;
  questionnaireRequest?: QuestionnaireRequest;
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
  error?: string;
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<ToolResult>;
}

export interface ToolExecutionContext {
  workspacePath: string;
  dataDir: string;
  sessionId: string;
  runId: string;
  workspaceId?: string;
  requestPermission: (req: PermissionRequest) => Promise<boolean>;
  requestQuestionnaire: (
    req: QuestionnaireRequest,
  ) => Promise<QuestionnaireResponse>;
}
