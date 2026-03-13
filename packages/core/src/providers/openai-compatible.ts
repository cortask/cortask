import OpenAI from "openai";
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

export function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (typeof msg.content === "string") {
      result.push({
        role: msg.role,
        content: msg.content,
      } as OpenAI.ChatCompletionMessageParam);
      continue;
    }

    // Skip thinking parts — OpenAI doesn't support them
    const filteredContent = msg.content.filter((p) => p.type !== "thinking");
    const toolUseParts = filteredContent.filter((p) => p.type === "tool_use");
    if (msg.role === "assistant" && toolUseParts.length > 0) {
      const textContent = filteredContent
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
      result.push({
        role: "assistant",
        content: textContent || null,
        tool_calls: toolUseParts.map((p) => ({
          id: p.toolCallId!,
          type: "function" as const,
          function: {
            name: p.toolName!,
            arguments: JSON.stringify(p.toolArguments ?? {}),
          },
        })),
      });
      continue;
    }

    const toolResultParts = filteredContent.filter((p) => p.type === "tool_result");
    if (toolResultParts.length > 0) {
      for (const p of toolResultParts) {
        result.push({
          role: "tool",
          tool_call_id: p.toolCallId!,
          content: p.text ?? "",
        });
      }
      continue;
    }

    const parts: OpenAI.ChatCompletionContentPart[] = filteredContent.map(
      (part) => {
        if (part.type === "image" && part.imageBase64) {
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${part.mimeType ?? "image/png"};base64,${part.imageBase64}`,
            },
          };
        }
        return { type: "text" as const, text: part.text ?? "" };
      },
    );
    result.push({
      role: msg.role,
      content: parts,
    } as OpenAI.ChatCompletionMessageParam);
  }

  return result;
}

export function toOpenAITools(
  tools: ToolDefinition[],
): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  protected client: OpenAI;

  constructor(id: string, apiKey: string, baseURL?: string) {
    this.id = id;
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.systemPrompt),
      tools: params.tools?.length ? toOpenAITools(params.tools) : undefined,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error(`No response from ${this.id}`);
    }

    const content = choice.message.content ?? "";
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(
      (tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }),
    );

    const stopReason =
      choice.finish_reason === "tool_calls"
        ? "tool_use"
        : choice.finish_reason === "length"
          ? "max_tokens"
          : "end";

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      stopReason,
    };
  }

  async *generateStream(
    params: GenerateTextParams,
  ): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.systemPrompt),
      tools: params.tools?.length ? toOpenAITools(params.tools) : undefined,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) {
        // Final chunk may have usage without choices
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
        continue;
      }

      if (delta.content) {
        yield { type: "text", text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            yield {
              type: "tool_call_start",
              toolCall: { id: tc.id, name: tc.function?.name },
            };
          }
          if (tc.function?.arguments) {
            yield { type: "tool_call_delta", text: tc.function.arguments };
          }
        }
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    yield {
      type: "message_end",
      usage: { inputTokens, outputTokens },
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const response = await this.client.embeddings.create({
      model: params.model,
      input: params.inputs,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      usage: { totalTokens: response.usage.total_tokens },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return getModelDefinitions(this.id);
  }
}
