import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class MiniMaxProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super("minimax", apiKey, "https://api.minimax.chat/v1");
  }
}
