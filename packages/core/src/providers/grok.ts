import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class GrokProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super("grok", apiKey, "https://api.x.ai/v1");
  }
}
