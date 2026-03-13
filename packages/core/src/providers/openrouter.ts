import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { ModelInfo } from "./types.js";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export class OpenRouterProvider extends OpenAICompatibleProvider {
  private apiKeyValue: string;

  constructor(apiKey: string) {
    super("openrouter", apiKey, "https://openrouter.ai/api/v1");
    this.apiKeyValue = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${this.apiKeyValue}` },
    });
    if (!response.ok) {
      throw new Error(`OpenRouter models API error: ${response.status}`);
    }
    const data = (await response.json()) as { data: OpenRouterModel[] };
    return data.data.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      contextWindow: m.context_length,
      inputPricePer1m: m.pricing?.prompt ? parseFloat(m.pricing.prompt) * 1_000_000 : undefined,
      outputPricePer1m: m.pricing?.completion ? parseFloat(m.pricing.completion) * 1_000_000 : undefined,
    }));
  }
}
