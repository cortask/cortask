import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class MoonshotProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super("moonshot", apiKey, "https://api.moonshot.cn/v1");
  }
}
