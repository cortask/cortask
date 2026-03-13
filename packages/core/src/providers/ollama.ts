import type {
  LLMProvider,
  GenerateTextParams,
  GenerateTextResult,
  StreamChunk,
  EmbedParams,
  EmbedResult,
  ModelInfo,
  ToolCall,
  ToolDefinition,
  Message,
} from "./types.js";

// -- Ollama native API types (per https://docs.ollama.com) --

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

interface OllamaToolCall {
  type: "function";
  function: {
    index: number;
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      required?: string[];
      properties: Record<string, unknown>;
    };
  };
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  tools?: OllamaTool[];
  options?: { temperature?: number; num_ctx?: number };
}

interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

// -- Convert our internal messages to Ollama format --

function toOllamaMessages(messages: Message[], systemPrompt?: string): OllamaMessage[] {
  const result: OllamaMessage[] = [];

  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (typeof msg.content === "string") {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Assistant message with tool calls
    const toolUseParts = msg.content.filter((p) => p.type === "tool_use");
    if (msg.role === "assistant" && toolUseParts.length > 0) {
      const textContent = msg.content
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
      result.push({
        role: "assistant",
        content: textContent,
        tool_calls: toolUseParts.map((p, i) => ({
          type: "function" as const,
          function: {
            index: i,
            name: p.toolName!,
            arguments: (p.toolArguments ?? {}) as Record<string, unknown>,
          },
        })),
      });
      continue;
    }

    // Tool result messages — one per tool call, using tool_name
    const toolResultParts = msg.content.filter((p) => p.type === "tool_result");
    if (toolResultParts.length > 0) {
      for (const p of toolResultParts) {
        result.push({
          role: "tool",
          content: p.text ?? "",
          tool_name: p.toolName,
        });
      }
      continue;
    }

    // Regular user/assistant message (may contain images)
    const texts: string[] = [];
    const images: string[] = [];
    for (const part of msg.content) {
      if (part.type === "image" && part.imageBase64) {
        images.push(part.imageBase64);
      } else if (part.text) {
        texts.push(part.text);
      }
    }
    const ollamaMsg: OllamaMessage = {
      role: msg.role,
      content: texts.join(""),
    };
    if (images.length > 0) {
      ollamaMsg.images = images;
    }
    result.push(ollamaMsg);
  }

  return result;
}

function toOllamaTools(tools: ToolDefinition[]): OllamaTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        required: (t.inputSchema as { required?: string[] }).required,
        properties: (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
      },
    },
  }));
}

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  private host: string;

  constructor(host: string) {
    this.host = host.replace(/\/+$/, "");
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const body: OllamaChatRequest = {
      model: params.model,
      messages: toOllamaMessages(params.messages, params.systemPrompt),
      stream: false,
      tools: params.tools?.length ? toOllamaTools(params.tools) : undefined,
      options: {
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        num_ctx: 16384,
      },
    };

    const response = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const msg = data.message;

    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc, i) => ({
      id: `ollama_tc_${i}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    const stopReason = toolCalls.length > 0 ? "tool_use" : "end";

    return {
      content: msg.content ?? "",
      toolCalls,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
      stopReason,
    };
  }

  async *generateStream(params: GenerateTextParams): AsyncIterable<StreamChunk> {
    const body: OllamaChatRequest = {
      model: params.model,
      messages: toOllamaMessages(params.messages, params.systemPrompt),
      stream: true,
      tools: params.tools?.length ? toOllamaTools(params.tools) : undefined,
      options: {
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        num_ctx: 16384,
      },
    };

    const response = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Ollama");

    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let chunk: OllamaChatResponse;
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }

        // Tool calls come as a complete object in one chunk
        if (chunk.message.tool_calls?.length) {
          for (let i = 0; i < chunk.message.tool_calls.length; i++) {
            const tc = chunk.message.tool_calls[i];
            const id = `ollama_tc_${i}`;
            yield {
              type: "tool_call_start",
              toolCall: { id, name: tc.function.name },
            };
            yield {
              type: "tool_call_delta",
              text: JSON.stringify(tc.function.arguments),
            };
          }
          continue;
        }

        // Text content
        if (chunk.message.content) {
          yield { type: "text", text: chunk.message.content };
        }

        // Capture usage from the final chunk
        if (chunk.done) {
          inputTokens = chunk.prompt_eval_count ?? 0;
          outputTokens = chunk.eval_count ?? 0;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer.trim()) as OllamaChatResponse;
        if (chunk.message.tool_calls?.length) {
          for (let i = 0; i < chunk.message.tool_calls.length; i++) {
            const tc = chunk.message.tool_calls[i];
            yield {
              type: "tool_call_start",
              toolCall: { id: `ollama_tc_${i}`, name: tc.function.name },
            };
            yield {
              type: "tool_call_delta",
              text: JSON.stringify(tc.function.arguments),
            };
          }
        } else if (chunk.message.content) {
          yield { type: "text", text: chunk.message.content };
        }
        if (chunk.done) {
          inputTokens = chunk.prompt_eval_count ?? 0;
          outputTokens = chunk.eval_count ?? 0;
        }
      } catch {
        // ignore
      }
    }

    yield {
      type: "message_end",
      usage: { inputTokens, outputTokens },
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const results: number[][] = [];
    let totalTokens = 0;

    for (const input of params.inputs) {
      const response = await fetch(`${this.host}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: params.model, input }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama embed error: ${response.status} ${text}`);
      }

      const data = (await response.json()) as {
        embeddings: number[][];
        prompt_eval_count?: number;
      };
      results.push(...data.embeddings);
      totalTokens += data.prompt_eval_count ?? 0;
    }

    return { embeddings: results, usage: { totalTokens } };
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.host}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list Ollama models: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      models: Array<{ name: string; size: number; details?: { parameter_size?: string } }>;
    };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      inputPricePer1m: 0,
      outputPricePer1m: 0,
    }));
  }
}
