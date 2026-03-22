import crypto from "node:crypto";
import fs from "node:fs/promises";
import nodePath from "node:path";
import type {
  LLMProvider,
  Message,
  ContentPart,
  ToolDefinition,
  ToolCall,
  GenerateTextParams,
  ToolResult,
} from "../providers/types.js";
import type {
  AgentRunParams,
  AgentRunResult,
  AgentStreamEvent,
  ToolHandler,
  ToolExecutionContext,
  PermissionRequest,
  QuestionnaireRequest,
  QuestionnaireResponse,
} from "./types.js";
import type { MemoryManager } from "../memory/manager.js";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt.js";
import { logger } from "../logging/logger.js";

const TOOL_CONCURRENCY = 5;
const TOOL_RESULT_HISTORY_LIMIT = 1500;

/**
 * Parse JSON robustly — handles unescaped control characters inside string
 * values that LLMs sometimes produce (e.g. literal newlines in HTML content).
 */
function parseToolJson(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    // Fix unescaped control characters within JSON string values
    let fixed = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < json.length; i++) {
      const ch = json[i];
      const code = json.charCodeAt(i);

      if (escaped) {
        fixed += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\" && inString) {
        fixed += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        fixed += ch;
        continue;
      }

      if (inString && code < 0x20) {
        // Escape control characters that are invalid inside JSON strings
        switch (ch) {
          case "\n": fixed += "\\n"; break;
          case "\r": fixed += "\\r"; break;
          case "\t": fixed += "\\t"; break;
          default: fixed += "\\u" + code.toString(16).padStart(4, "0");
        }
      } else {
        fixed += ch;
      }
    }

    return JSON.parse(fixed);
  }
}

/**
 * Ensure the last assistant message's tool_use blocks have matching
 * tool_result blocks. This prevents the "tool_use without tool_result"
 * API error when a run is cancelled mid-stream.
 */
function ensureToolResultsExist(messages: Message[]): void {
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== "assistant" || !Array.isArray(lastMsg.content)) return;

  const toolUseIds = lastMsg.content
    .filter((p) => p.type === "tool_use" && p.toolCallId)
    .map((p) => p.toolCallId!);

  if (toolUseIds.length === 0) return;

  // Check if there's already a following user message with tool_results
  // (there shouldn't be since this is the last message, but just in case)
  messages.push({
    role: "user",
    content: toolUseIds.map((id) => ({
      type: "tool_result" as const,
      toolCallId: id,
      text: "[Cancelled]",
      isError: true,
    })),
  });
}

function truncateOldToolResults(messages: Message[], startIdx: number): void {
  for (let i = 0; i < startIdx; i++) {
    const msg = messages[i];
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (
        part.type === "tool_result" &&
        part.text &&
        part.text.length > TOOL_RESULT_HISTORY_LIMIT
      ) {
        part.text =
          part.text.slice(0, TOOL_RESULT_HISTORY_LIMIT) +
          "\n...(truncated — full result was processed earlier)";
      }
    }
  }
}

async function pLimit<T>(
  concurrency: number,
  tasks: Array<() => Promise<T>>,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  });

  await Promise.all(workers);
  return results;
}

export interface AgentRunnerConfig {
  provider: LLMProvider;
  model: string;
  maxTurns: number;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentRunnerDeps {
  config: AgentRunnerConfig;
  tools: ToolHandler[];
  getWorkspacePath: () => string;
  getDataDir: () => string;
  getMemoryContent: () => Promise<string | undefined>;
  getGlobalMemoryContent: () => Promise<string | undefined>;
  getSkillPrompts: () => string[];
  getSessionMessages: (sessionId: string) => Promise<Message[]>;
  saveSessionMessages: (sessionId: string, messages: Message[]) => Promise<void>;
  memoryManager?: MemoryManager;
  channel?: { type: string; chatId: string };
  onPermissionRequest?: (req: PermissionRequest) => Promise<boolean>;
  onQuestionnaireRequest?: (
    req: QuestionnaireRequest,
  ) => Promise<QuestionnaireResponse>;
}

export class AgentRunner {
  private deps: AgentRunnerDeps;

  constructor(deps: AgentRunnerDeps) {
    this.deps = deps;
  }

  private buildToolDefinitions(): ToolDefinition[] {
    return this.deps.tools.map((t) => t.definition);
  }

  private getToolHandler(name: string): ToolHandler | undefined {
    return this.deps.tools.find((t) => t.definition.name === name);
  }

  private async buildSystemPromptText(): Promise<string> {
    const [memoryContent, globalMemoryContent] = await Promise.all([
      this.deps.getMemoryContent(),
      this.deps.getGlobalMemoryContent(),
    ]);
    const ctx: SystemPromptContext = {
      workspacePath: this.deps.getWorkspacePath(),
      globalMemoryContent,
      memoryContent,
      skillPrompts: this.deps.getSkillPrompts(),
      toolNames: this.deps.tools.map((t) => t.definition.name),
      channel: this.deps.channel,
    };
    return buildSystemPrompt(ctx);
  }

  private createToolContext(sessionId: string, runId: string, workspaceId?: string): ToolExecutionContext {
    return {
      workspacePath: this.deps.getWorkspacePath(),
      dataDir: this.deps.getDataDir(),
      sessionId,
      runId,
      workspaceId,
      requestPermission: async (req: PermissionRequest) => {
        if (this.deps.onPermissionRequest) {
          return this.deps.onPermissionRequest(req);
        }
        return true;
      },
      requestQuestionnaire: async (req: QuestionnaireRequest) => {
        if (this.deps.onQuestionnaireRequest) {
          return this.deps.onQuestionnaireRequest(req);
        }
        return {};
      },
      memoryManager: this.deps.memoryManager,
    };
  }

  private async readFileReferences(refs?: string[]): Promise<ContentPart[]> {
    if (!refs?.length) return [];
    const workspacePath = this.deps.getWorkspacePath();
    const parts: ContentPart[] = [];
    const MAX_FILE_SIZE = 50 * 1024; // 50KB

    for (const ref of refs) {
      const fullPath = nodePath.resolve(workspacePath, ref);
      if (!fullPath.startsWith(nodePath.resolve(workspacePath))) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_FILE_SIZE) {
          parts.push({ type: "text", text: `[File: ${ref}]\n(Skipped — file exceeds 50KB limit)` });
          continue;
        }
        const content = await fs.readFile(fullPath, "utf-8");
        parts.push({ type: "text", text: `[File: ${ref}]\n\`\`\`\n${content}\n\`\`\`` });
      } catch {
        parts.push({ type: "text", text: `[File: ${ref}]\n(File not found or unreadable)` });
      }
    }
    return parts;
  }

  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const runId = crypto.randomUUID();
    const sessionId = params.sessionId ?? crypto.randomUUID();
    const { config } = this.deps;

    const messages = await this.deps.getSessionMessages(sessionId);

    const fileRefParts = await this.readFileReferences(params.fileReferences);
    const hasMultipart = (params.attachments?.length ?? 0) > 0 || fileRefParts.length > 0;

    if (hasMultipart) {
      const parts: ContentPart[] = [
        { type: "text", text: params.prompt },
        ...fileRefParts,
        ...(params.attachments?.map((a) => ({
          type: "image" as const,
          imageBase64: a.base64,
          mimeType: a.mimeType,
        })) ?? []),
      ];
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: params.prompt });
    }

    const systemPrompt = await this.buildSystemPromptText();
    const toolDefs = this.buildToolDefinitions();
    const toolContext = this.createToolContext(sessionId, runId, params.workspaceId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const allToolCalls: ToolCall[] = [];
    let finalContent = "";

    for (let turn = 0; turn < config.maxTurns; turn++) {
      if (turn > 0) {
        truncateOldToolResults(messages, messages.length);
      }

      const generateParams: GenerateTextParams = {
        model: config.model,
        messages,
        systemPrompt,
        tools: toolDefs,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };

      const result = await config.provider.generateText(generateParams);

      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;

      logger.debug(
        `Turn ${turn}: in=${result.usage.inputTokens} out=${result.usage.outputTokens} stop=${result.stopReason}`,
        "agent",
      );

      if (result.content) {
        finalContent = result.content;
      }

      // Build assistant message
      if (result.content || result.thinking || result.toolCalls.length > 0) {
        const parts: ContentPart[] = [];
        if (result.thinking) {
          parts.push({ type: "thinking", text: result.thinking });
        }
        if (result.content) {
          parts.push({ type: "text", text: result.content });
        }
        for (const tc of result.toolCalls) {
          parts.push({
            type: "tool_use",
            toolCallId: tc.id,
            toolName: tc.name,
            toolArguments: tc.arguments,
          });
        }
        messages.push({ role: "assistant", content: parts });
      }

      // No tool calls or stop reason isn't tool_use → done
      if (result.toolCalls.length === 0 || result.stopReason !== "tool_use") {
        break;
      }

      allToolCalls.push(...result.toolCalls);

      // Execute tool calls with concurrency limit
      const toolResults = await pLimit(
        TOOL_CONCURRENCY,
        result.toolCalls.map((toolCall) => async () => {
          const handler = this.getToolHandler(toolCall.name);
          if (!handler) {
            return {
              toolCallId: toolCall.id,
              content: `Unknown tool: ${toolCall.name}`,
              isError: true,
            } satisfies ToolResult;
          }
          try {
            return await handler.execute(toolCall.arguments, toolContext);
          } catch (err) {
            return {
              toolCallId: toolCall.id,
              content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            } satisfies ToolResult;
          }
        }),
      );

      // Add tool results as user message
      const toolResultParts: ContentPart[] = result.toolCalls.map(
        (toolCall, i) => ({
          type: "tool_result" as const,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          text: toolResults[i].content,
          isError: toolResults[i].isError,
        }),
      );
      messages.push({ role: "user", content: toolResultParts });

      // Warn when running low on turns
      const remaining = config.maxTurns - turn - 1;
      if (remaining === 2) {
        messages.push({
          role: "user",
          content:
            "[System: 2 tool turns remaining. Focus on completing the task.]",
        });
      }
    }

    // Ensure no dangling tool_use blocks before saving
    ensureToolResultsExist(messages);
    await this.deps.saveSessionMessages(sessionId, messages);

    return {
      runId,
      response: finalContent,
      toolCalls: allToolCalls,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  }

  async *runStream(params: AgentRunParams): AsyncIterable<AgentStreamEvent> {
    const runId = crypto.randomUUID();
    const sessionId = params.sessionId ?? crypto.randomUUID();
    const { config } = this.deps;
    const signal = params.signal;

    const messages = await this.deps.getSessionMessages(sessionId);

    // Build user message with optional image attachments and file references
    const streamFileRefParts = await this.readFileReferences(params.fileReferences);
    const streamHasMultipart = (params.attachments?.length ?? 0) > 0 || streamFileRefParts.length > 0;

    if (streamHasMultipart) {
      const parts: ContentPart[] = [
        { type: "text", text: params.prompt },
        ...streamFileRefParts,
        ...(params.attachments?.map((a) => ({
          type: "image" as const,
          imageBase64: a.base64,
          mimeType: a.mimeType,
        })) ?? []),
      ];
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: params.prompt });
    }

    const systemPrompt = await this.buildSystemPromptText();
    const toolDefs = this.buildToolDefinitions();
    const toolContext = this.createToolContext(sessionId, runId, params.workspaceId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalContent = "";

    for (let turn = 0; turn < config.maxTurns; turn++) {
      // Check for cancellation before each turn
      if (signal?.aborted) {
        logger.debug("Agent run cancelled", "agent");
        break;
      }

      if (turn > 0) {
        truncateOldToolResults(messages, messages.length);
      }

      const generateParams: GenerateTextParams = {
        model: config.model,
        messages,
        systemPrompt,
        tools: toolDefs,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };

      // Use streaming for text output
      const parts: ContentPart[] = [];
      let currentText = "";
      let currentThinking = "";
      const toolCalls: ToolCall[] = [];
      const toolCallBuffers = new Map<number, { id: string; name: string; jsonChunks: string[] }>();

      // State machine for detecting <thinking> tags in text streams (fallback for non-native providers)
      let inThinkingTag = false;
      let tagBuffer = "";

      for await (const chunk of config.provider.generateStream(generateParams)) {
        if (signal?.aborted) break;
        if (chunk.type === "thinking" && chunk.text) {
          // Native thinking from provider (Anthropic, Gemini)
          currentThinking += chunk.text;
          yield { type: "thinking_delta", text: chunk.text };
        } else if (chunk.type === "text" && chunk.text) {
          // Process text through <thinking> tag detector for non-native providers
          let text = tagBuffer + chunk.text;
          tagBuffer = "";

          while (text.length > 0) {
            if (inThinkingTag) {
              const closeIdx = text.indexOf("</thinking>");
              if (closeIdx !== -1) {
                const thinkText = text.slice(0, closeIdx);
                if (thinkText) {
                  currentThinking += thinkText;
                  yield { type: "thinking_delta", text: thinkText };
                }
                inThinkingTag = false;
                text = text.slice(closeIdx + "</thinking>".length);
              } else if (text.length > 11 && text.slice(-11).includes("<")) {
                // Might have a partial </thinking> at the end
                const lastOpen = text.lastIndexOf("<");
                const thinkText = text.slice(0, lastOpen);
                if (thinkText) {
                  currentThinking += thinkText;
                  yield { type: "thinking_delta", text: thinkText };
                }
                tagBuffer = text.slice(lastOpen);
                text = "";
              } else {
                currentThinking += text;
                yield { type: "thinking_delta", text };
                text = "";
              }
            } else {
              const openIdx = text.indexOf("<thinking>");
              if (openIdx !== -1) {
                const before = text.slice(0, openIdx);
                if (before) {
                  currentText += before;
                  yield { type: "text_delta", text: before };
                }
                inThinkingTag = true;
                text = text.slice(openIdx + "<thinking>".length);
              } else if (text.length > 10 && text.slice(-10).includes("<")) {
                // Might have a partial <thinking> at the end
                const lastOpen = text.lastIndexOf("<");
                const before = text.slice(0, lastOpen);
                if (before) {
                  currentText += before;
                  yield { type: "text_delta", text: before };
                }
                tagBuffer = text.slice(lastOpen);
                text = "";
              } else {
                currentText += text;
                yield { type: "text_delta", text };
                text = "";
              }
            }
          }
        } else if (chunk.type === "tool_call_start" && chunk.toolCall) {
          // Flush any remaining tag buffer as text
          if (tagBuffer) {
            currentText += tagBuffer;
            yield { type: "text_delta", text: tagBuffer };
            tagBuffer = "";
          }
          const idx = toolCallBuffers.size;
          toolCallBuffers.set(idx, {
            id: chunk.toolCall.id ?? `tc_${idx}`,
            name: chunk.toolCall.name ?? "unknown",
            jsonChunks: [],
          });
          yield {
            type: "tool_call_start",
            toolName: chunk.toolCall.name,
            toolCallId: chunk.toolCall.id,
          };
        } else if (chunk.type === "tool_call_delta" && chunk.text) {
          const idx = toolCallBuffers.size - 1;
          const buf = toolCallBuffers.get(idx);
          if (buf) buf.jsonChunks.push(chunk.text);
          yield { type: "tool_call_delta", text: chunk.text };
        } else if (chunk.type === "tool_call_end") {
          yield { type: "tool_call_end" };
        } else if (chunk.type === "message_end" && chunk.usage) {
          totalInputTokens += chunk.usage.inputTokens;
          totalOutputTokens += chunk.usage.outputTokens;
        }
      }

      // Flush remaining tag buffer
      if (tagBuffer) {
        if (inThinkingTag) {
          currentThinking += tagBuffer;
          yield { type: "thinking_delta", text: tagBuffer };
        } else {
          currentText += tagBuffer;
          yield { type: "text_delta", text: tagBuffer };
        }
      }

      // Reconstruct tool calls from buffers
      const parseErrors: Array<{ id: string; name: string; error: string }> = [];
      for (const [, buf] of toolCallBuffers) {
        const json = buf.jsonChunks.join("");
        if (!json) {
          toolCalls.push({ id: buf.id, name: buf.name, arguments: {} });
          continue;
        }
        try {
          const args = parseToolJson(json);
          toolCalls.push({ id: buf.id, name: buf.name, arguments: args });
        } catch (err) {
          parseErrors.push({
            id: buf.id,
            name: buf.name,
            error: `Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      if (currentThinking) {
        parts.push({ type: "thinking", text: currentThinking });
      }
      if (currentText) {
        parts.push({ type: "text", text: currentText });
        finalContent = currentText;
      }
      // Add both valid tool calls and parse-errored ones to assistant message
      for (const tc of toolCalls) {
        parts.push({
          type: "tool_use",
          toolCallId: tc.id,
          toolName: tc.name,
          toolArguments: tc.arguments,
        });
      }
      for (const pe of parseErrors) {
        parts.push({
          type: "tool_use",
          toolCallId: pe.id,
          toolName: pe.name,
          toolArguments: {},
        });
      }
      if (parts.length > 0) {
        messages.push({ role: "assistant", content: parts });
      }

      // No tool calls and no parse errors → done
      if (toolCalls.length === 0 && parseErrors.length === 0) {
        break;
      }

      // Check for cancellation before executing tools
      if (signal?.aborted) {
        logger.debug("Agent run cancelled before tool execution", "agent");
        break;
      }

      // Execute valid tool calls
      const toolResults = await pLimit(
        TOOL_CONCURRENCY,
        toolCalls.map((toolCall) => async () => {
          const handler = this.getToolHandler(toolCall.name);
          if (!handler) {
            return {
              toolCallId: toolCall.id,
              content: `Unknown tool: ${toolCall.name}`,
              isError: true,
            } satisfies ToolResult;
          }
          try {
            return await handler.execute(toolCall.arguments, toolContext);
          } catch (err) {
            return {
              toolCallId: toolCall.id,
              content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            } satisfies ToolResult;
          }
        }),
      );

      // Build results for parse-errored tool calls (not executed)
      const errorResults: ToolResult[] = parseErrors.map((pe) => ({
        toolCallId: pe.id,
        content: pe.error,
        isError: true,
      }));

      // Yield tool results and add to messages
      const allResults = [...toolResults, ...errorResults];
      const allCalls = [
        ...toolCalls,
        ...parseErrors.map((pe) => ({ id: pe.id, name: pe.name, arguments: {} })),
      ];

      const toolResultParts: ContentPart[] = allCalls.map((tc, i) => ({
        type: "tool_result" as const,
        toolCallId: tc.id,
        toolName: tc.name,
        text: allResults[i].content,
        isError: allResults[i].isError,
      }));

      for (let i = 0; i < allResults.length; i++) {
        yield {
          type: "tool_result",
          toolCallId: allCalls[i].id,
          toolName: allCalls[i].name,
          toolArgs: allCalls[i].arguments,
          toolResult: allResults[i],
        };
      }

      messages.push({ role: "user", content: toolResultParts });

      const remaining = config.maxTurns - turn - 1;
      if (remaining === 2) {
        messages.push({
          role: "user",
          content:
            "[System: 2 tool turns remaining. Focus on completing the task.]",
        });
      }
    }

    // Ensure no dangling tool_use blocks before saving
    ensureToolResultsExist(messages);
    await this.deps.saveSessionMessages(sessionId, messages);

    yield {
      type: "done",
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  }
}
