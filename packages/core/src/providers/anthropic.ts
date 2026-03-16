import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  GenerateTextParams,
  GenerateTextResult,
  StreamChunk,
  EmbedParams,
  EmbedResult,
  ModelInfo,
  Message,
  ToolDefinition,
  ToolCall,
} from "./types.js";
import { getModelDefinitions } from "../models/definitions.js";

function toAnthropicMessages(
  messages: Message[],
): Anthropic.MessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (typeof m.content === "string") {
        return {
          role: m.role as "user" | "assistant",
          content: m.content,
        };
      }

      const content: Anthropic.ContentBlockParam[] = m.content
        .filter((part) => part.type !== "thinking")
        .map((part) => {
          if (part.type === "tool_use") {
            return {
              type: "tool_use" as const,
              id: part.toolCallId!,
              name: part.toolName!,
              input: part.toolArguments ?? {},
            };
          }
          if (part.type === "tool_result") {
            return {
              type: "tool_result" as const,
              tool_use_id: part.toolCallId!,
              content: part.text ?? "",
              is_error: part.isError ?? false,
            };
          }
          if (part.type === "image" && part.imageBase64) {
            return {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: (part.mimeType ?? "image/png") as
                  | "image/png"
                  | "image/jpeg"
                  | "image/gif"
                  | "image/webp",
                data: part.imageBase64,
              },
            };
          }
          return { type: "text" as const, text: part.text ?? "" };
        });

      return {
        role: m.role as "user" | "assistant",
        content,
      };
    });
}

function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  }));
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const maxTokens = params.maxTokens ?? 16000;
    const budgetTokens = 10000;
    const useThinking = maxTokens > budgetTokens;
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: maxTokens,
      temperature: 1,
      system: params.systemPrompt,
      messages: toAnthropicMessages(params.messages),
      tools: params.tools ? toAnthropicTools(params.tools) : undefined,
      ...(useThinking ? { thinking: { type: "enabled", budget_tokens: budgetTokens } } : {}),
    } as Anthropic.MessageCreateParams) as Anthropic.Message;

    let content = "";
    let thinking = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "thinking") {
        thinking += (block as unknown as { type: "thinking"; thinking: string }).thinking;
      } else if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    const stopReason =
      response.stop_reason === "tool_use"
        ? "tool_use"
        : response.stop_reason === "max_tokens"
          ? "max_tokens"
          : "end";

    return {
      content,
      thinking: thinking || undefined,
      toolCalls,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason,
    };
  }

  async *generateStream(
    params: GenerateTextParams,
  ): AsyncIterable<StreamChunk> {
    const maxTokens = params.maxTokens ?? 16000;
    const budgetTokens = 10000;
    const useThinking = maxTokens > budgetTokens;
    const stream = this.client.messages.stream({
      model: params.model,
      max_tokens: maxTokens,
      temperature: 1,
      system: params.systemPrompt,
      messages: toAnthropicMessages(params.messages),
      tools: params.tools ? toAnthropicTools(params.tools) : undefined,
      ...(useThinking ? { thinking: { type: "enabled", budget_tokens: budgetTokens } } : {}),
    } as Anthropic.MessageCreateParams);

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          yield {
            type: "tool_call_start",
            toolCall: {
              id: event.content_block.id,
              name: event.content_block.name,
            },
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          yield { type: "thinking", text: (event.delta as { type: "thinking_delta"; thinking: string }).thinking };
        } else if (event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        } else if (event.delta.type === "input_json_delta") {
          yield { type: "tool_call_delta", text: event.delta.partial_json };
        }
      } else if (event.type === "content_block_stop") {
        yield { type: "tool_call_end" };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "message_end",
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    };
  }

  async embed(_params: EmbedParams): Promise<EmbedResult> {
    throw new Error(
      "Anthropic does not support embeddings. Use OpenAI or Google for embeddings.",
    );
  }

  async listModels(): Promise<ModelInfo[]> {
    return getModelDefinitions("anthropic");
  }
}
