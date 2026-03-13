import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super("openai", apiKey);
  }
}
