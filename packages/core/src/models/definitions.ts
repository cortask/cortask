import type { ModelInfo } from "../providers/types.js";

export type ProviderId = "anthropic" | "openai" | "google" | "moonshot" | "grok" | "openrouter" | "minimax";

/**
 * Hardcoded model definitions with pricing (per 1M tokens in USD).
 * OpenRouter is excluded — it fetches models from its API.
 */
export const MODEL_DEFINITIONS: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200000, inputPricePer1m: 15, outputPricePer1m: 75 },
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", contextWindow: 200000, inputPricePer1m: 3, outputPricePer1m: 15 },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", contextWindow: 200000, inputPricePer1m: 0.8, outputPricePer1m: 4 },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, inputPricePer1m: 3, outputPricePer1m: 15 },
  ],
  openai: [
    { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1047576, inputPricePer1m: 2, outputPricePer1m: 8 },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1047576, inputPricePer1m: 0.4, outputPricePer1m: 1.6 },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", contextWindow: 1047576, inputPricePer1m: 0.1, outputPricePer1m: 0.4 },
    { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, inputPricePer1m: 2.5, outputPricePer1m: 10 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, inputPricePer1m: 0.15, outputPricePer1m: 0.6 },
    { id: "o3", name: "o3", contextWindow: 200000, inputPricePer1m: 10, outputPricePer1m: 40 },
    { id: "o3-mini", name: "o3 Mini", contextWindow: 200000, inputPricePer1m: 1.1, outputPricePer1m: 4.4 },
    { id: "o4-mini", name: "o4 Mini", contextWindow: 200000, inputPricePer1m: 1.1, outputPricePer1m: 4.4 },
  ],
  google: [
    { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", contextWindow: 1048576, inputPricePer1m: 1.25, outputPricePer1m: 10 },
    { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash", contextWindow: 1048576, inputPricePer1m: 0.15, outputPricePer1m: 0.6 },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, inputPricePer1m: 0.1, outputPricePer1m: 0.4 },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", contextWindow: 1048576, inputPricePer1m: 0.075, outputPricePer1m: 0.3 },
  ],
  grok: [
    { id: "grok-3", name: "Grok 3", contextWindow: 131072, inputPricePer1m: 3, outputPricePer1m: 15 },
    { id: "grok-3-fast", name: "Grok 3 Fast", contextWindow: 131072, inputPricePer1m: 5, outputPricePer1m: 25 },
    { id: "grok-3-mini", name: "Grok 3 Mini", contextWindow: 131072, inputPricePer1m: 0.3, outputPricePer1m: 0.5 },
    { id: "grok-3-mini-fast", name: "Grok 3 Mini Fast", contextWindow: 131072, inputPricePer1m: 0.6, outputPricePer1m: 4 },
  ],
  moonshot: [
    { id: "moonshot-v1-8k", name: "Moonshot v1 8K", contextWindow: 8000, inputPricePer1m: 1.5, outputPricePer1m: 2 },
    { id: "moonshot-v1-32k", name: "Moonshot v1 32K", contextWindow: 32000, inputPricePer1m: 3, outputPricePer1m: 4 },
    { id: "moonshot-v1-128k", name: "Moonshot v1 128K", contextWindow: 128000, inputPricePer1m: 8, outputPricePer1m: 10 },
    { id: "kimi-latest", name: "Kimi Latest", contextWindow: 131072, inputPricePer1m: 2, outputPricePer1m: 6 },
  ],
  minimax: [
    { id: "MiniMax-Text-01", name: "MiniMax Text 01", contextWindow: 1000000, inputPricePer1m: 1, outputPricePer1m: 5 },
    { id: "abab6.5s-chat", name: "ABAB 6.5s Chat", contextWindow: 245760, inputPricePer1m: 0.5, outputPricePer1m: 1 },
  ],
};

export function getModelDefinitions(providerId: string): ModelInfo[] {
  return MODEL_DEFINITIONS[providerId] ?? [];
}
