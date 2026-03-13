import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  SchemaType,
} from "@google/generative-ai";
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

function toGeminiContents(messages: Message[]): Content[] {
  const result: Content[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (typeof m.content === "string") {
      result.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
      continue;
    }

    const toolResultParts = m.content.filter((p) => p.type === "tool_result");
    if (toolResultParts.length > 0) {
      result.push({
        role: "function" as string,
        parts: toolResultParts.map(
          (p): Part => ({
            functionResponse: {
              name: p.toolName ?? "unknown",
              response: { result: p.text ?? "" },
            },
          }),
        ),
      });
      continue;
    }

    const parts: Part[] = [];
    for (const part of m.content) {
      if (part.type === "thinking") continue;
      if (part.type === "tool_use") {
        parts.push({
          functionCall: {
            name: part.toolName!,
            args: (part.toolArguments ?? {}) as Record<string, string>,
          },
        });
      } else if (part.type === "image" && part.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: part.mimeType ?? "image/png",
            data: part.imageBase64,
          },
        });
      } else {
        parts.push({ text: part.text ?? "" });
      }
    }

    result.push({
      role: m.role === "assistant" ? "model" : "user",
      parts,
    });
  }

  return result;
}

function jsonSchemaTypeToGemini(type: string): SchemaType {
  switch (type) {
    case "string":
      return SchemaType.STRING;
    case "number":
      return SchemaType.NUMBER;
    case "integer":
      return SchemaType.INTEGER;
    case "boolean":
      return SchemaType.BOOLEAN;
    case "array":
      return SchemaType.ARRAY;
    case "object":
      return SchemaType.OBJECT;
    default:
      return SchemaType.STRING;
  }
}

function convertJsonSchemaToGemini(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (schema.type) {
    result.type = jsonSchemaTypeToGemini(schema.type as string);
  }
  if (schema.description) result.description = schema.description;
  if (schema.properties) {
    const props: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      schema.properties as Record<string, Record<string, unknown>>,
    )) {
      props[key] = convertJsonSchemaToGemini(val);
    }
    result.properties = props;
  }
  if (schema.required) result.required = schema.required;
  if (schema.items)
    result.items = convertJsonSchemaToGemini(
      schema.items as Record<string, unknown>,
    );
  return result;
}

function toGeminiTools(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: convertJsonSchemaToGemini(t.inputSchema) as unknown as FunctionDeclaration["parameters"],
  }));
}

export class GoogleProvider implements LLMProvider {
  readonly id = "google";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const model = this.client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
      },
      tools: params.tools?.length
        ? [{ functionDeclarations: toGeminiTools(params.tools) }]
        : undefined,
    });

    const result = await model.generateContent({
      contents: toGeminiContents(params.messages),
    });

    const response = result.response;
    let content = "";
    const toolCalls: ToolCall[] = [];

    let thinking = "";
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content.parts) {
        if ((part as { thought?: boolean }).thought && part.text) {
          thinking += part.text;
        } else if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: part.functionCall.name,
            arguments: (part.functionCall.args ?? {}) as Record<
              string,
              unknown
            >,
          });
        }
      }
    }

    const usageMeta = response.usageMetadata;
    const stopReason = toolCalls.length > 0 ? "tool_use" : "end";

    return {
      content,
      thinking: thinking || undefined,
      toolCalls,
      usage: {
        inputTokens: usageMeta?.promptTokenCount ?? 0,
        outputTokens: usageMeta?.candidatesTokenCount ?? 0,
      },
      stopReason,
    };
  }

  async *generateStream(
    params: GenerateTextParams,
  ): AsyncIterable<StreamChunk> {
    const model = this.client.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
      },
      tools: params.tools?.length
        ? [{ functionDeclarations: toGeminiTools(params.tools) }]
        : undefined,
    });

    const result = await model.generateContentStream({
      contents: toGeminiContents(params.messages),
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of result.stream) {
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
      }
      for (const candidate of chunk.candidates ?? []) {
        for (const part of candidate.content.parts) {
          if ((part as { thought?: boolean }).thought && part.text) {
            yield { type: "thinking", text: part.text };
          } else if (part.text) {
            yield { type: "text", text: part.text };
          }
          if (part.functionCall) {
            yield {
              type: "tool_call_start",
              toolCall: {
                id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: part.functionCall.name,
                arguments: (part.functionCall.args ?? {}) as Record<
                  string,
                  unknown
                >,
              },
            };
            yield { type: "tool_call_end" };
          }
        }
      }
    }

    yield {
      type: "message_end",
      usage: { inputTokens, outputTokens },
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const model = this.client.getGenerativeModel({ model: params.model });

    const result = await model.batchEmbedContents({
      requests: params.inputs.map((input) => ({
        content: { role: "user", parts: [{ text: input }] },
      })),
    });

    return {
      embeddings: result.embeddings.map((e) => e.values),
      usage: { totalTokens: 0 },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return getModelDefinitions("google");
  }
}
