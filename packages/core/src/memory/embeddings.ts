import crypto from "node:crypto";
import type { LLMProvider } from "../providers/types.js";
import type { MemoryStore } from "./store.js";
import type { LocalEmbeddingProvider } from "./embeddings-local.js";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export class EmbeddingService {
  private apiProvider: LLMProvider | null;
  private localProvider: LocalEmbeddingProvider | null;
  private model: string;
  private store: MemoryStore;

  constructor(opts: {
    apiProvider?: LLMProvider;
    localProvider?: LocalEmbeddingProvider;
    model?: string;
    store: MemoryStore;
  }) {
    this.apiProvider = opts.apiProvider ?? null;
    this.localProvider = opts.localProvider ?? null;
    this.model = opts.model ?? DEFAULT_EMBEDDING_MODEL;
    this.store = opts.store;
  }

  get providerId(): string {
    if (this.localProvider) return "local";
    return this.apiProvider?.id ?? "unknown";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const toEmbed: { index: number; text: string }[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const hash = this.hashContent(texts[i]);
      const cached = this.store.getCachedEmbedding(hash, this.providerModel);
      if (cached) {
        results[i] = cached;
      } else {
        toEmbed.push({ index: i, text: texts[i] });
      }
    }

    // Embed uncached texts
    if (toEmbed.length > 0) {
      const embeddings = await this.generateEmbeddings(
        toEmbed.map((t) => t.text),
      );

      for (let i = 0; i < toEmbed.length; i++) {
        const embedding = embeddings[i];
        const entry = toEmbed[i];
        results[entry.index] = embedding;

        const hash = this.hashContent(entry.text);
        this.store.setCachedEmbedding(hash, this.providerModel, embedding);
      }
    }

    return results as number[][];
  }

  async embedSingle(text: string): Promise<number[]> {
    const [result] = await this.embed([text]);
    return result;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.localProvider) {
      return this.localProvider.embedBatch(texts);
    }
    if (this.apiProvider) {
      const result = await this.apiProvider.embed({
        model: this.model,
        inputs: texts,
      });
      return result.embeddings;
    }
    throw new Error("No embedding provider available");
  }

  private get providerModel(): string {
    if (this.localProvider) {
      return `local:${this.localProvider.model}`;
    }
    return `${this.apiProvider?.id ?? "unknown"}:${this.model}`;
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
