export * from "./types.js";
export { OpenAICompatibleProvider } from "./openai-compatible.js";
export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { GoogleProvider } from "./google.js";
export { MoonshotProvider } from "./moonshot.js";
export { GrokProvider } from "./grok.js";
export { OpenRouterProvider } from "./openrouter.js";
export { MiniMaxProvider } from "./minimax.js";
export { OllamaProvider } from "./ollama.js";

import type { LLMProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GoogleProvider } from "./google.js";
import { MoonshotProvider } from "./moonshot.js";
import { GrokProvider } from "./grok.js";
import { OpenRouterProvider } from "./openrouter.js";
import { MiniMaxProvider } from "./minimax.js";
import { OllamaProvider } from "./ollama.js";

export type ProviderId = "anthropic" | "openai" | "google" | "moonshot" | "grok" | "openrouter" | "minimax" | "ollama";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  requiresApiKey: boolean;
}

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Anthropic (Claude)", requiresApiKey: true },
  { id: "openai", name: "OpenAI (GPT)", requiresApiKey: true },
  { id: "google", name: "Google (Gemini)", requiresApiKey: true },
  { id: "moonshot", name: "Moonshot (Kimi)", requiresApiKey: true },
  { id: "grok", name: "xAI (Grok)", requiresApiKey: true },
  { id: "openrouter", name: "OpenRouter", requiresApiKey: true },
  { id: "minimax", name: "MiniMax", requiresApiKey: true },
  { id: "ollama", name: "Ollama", requiresApiKey: false },
];

export function getProviderInfo(id: ProviderId): ProviderInfo | undefined {
  return AVAILABLE_PROVIDERS.find((p) => p.id === id);
}

export function createProvider(
  id: ProviderId,
  apiKey: string,
): LLMProvider {
  switch (id) {
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "openai":
      return new OpenAIProvider(apiKey);
    case "google":
      return new GoogleProvider(apiKey);
    case "moonshot":
      return new MoonshotProvider(apiKey);
    case "grok":
      return new GrokProvider(apiKey);
    case "openrouter":
      return new OpenRouterProvider(apiKey);
    case "minimax":
      return new MiniMaxProvider(apiKey);
    case "ollama":
      return new OllamaProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}
