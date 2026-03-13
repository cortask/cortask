import { createProvider, type ProviderId } from "../providers/index.js";
import type { ProviderValidationResult } from "./types.js";

export async function validateProvider(
  type: ProviderId,
  apiKey: string,
): Promise<ProviderValidationResult> {
  try {
    const provider = createProvider(type, apiKey);

    // Test with a simple prompt
    const result = await provider.generateText({
      model: getDefaultModel(type),
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 10,
    });

    return {
      valid: true,
      model: getDefaultModel(type),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid API key",
    };
  }
}

function getDefaultModel(type: ProviderId): string {
  switch (type) {
    case "anthropic":
      return "claude-sonnet-4-5-20250929";
    case "openai":
      return "gpt-4o";
    case "google":
      return "gemini-2.0-flash-exp";
    case "moonshot":
      return "moonshot-v1-8k";
    case "grok":
      return "grok-3-latest";
    case "openrouter":
      return "openai/gpt-4o";
    case "minimax":
      return "MiniMax-Text-01";
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
