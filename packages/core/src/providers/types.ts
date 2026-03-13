export interface Message {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

export interface ContentPart {
  type: "text" | "image" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
  artifactType?: string;
  artifactId?: string;
  artifacts?: Array<{
    id: string;
    type: string;
    meta?: Record<string, unknown>;
  }>;
}

export interface GenerateTextParams {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  content: string;
  thinking?: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: "end" | "tool_use" | "max_tokens";
}

export interface StreamChunk {
  type: "text" | "thinking" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "message_end";
  text?: string;
  toolCall?: Partial<ToolCall>;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface EmbedParams {
  model: string;
  inputs: string[];
}

export interface EmbedResult {
  embeddings: number[][];
  usage: { totalTokens: number };
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  inputPricePer1m?: number;
  outputPricePer1m?: number;
}

export interface LLMProvider {
  readonly id: string;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStream(params: GenerateTextParams): AsyncIterable<StreamChunk>;
  embed(params: EmbedParams): Promise<EmbedResult>;
  listModels(): Promise<ModelInfo[]>;
}
