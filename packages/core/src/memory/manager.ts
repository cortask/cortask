import crypto from "node:crypto";
import type { LLMProvider } from "../providers/types.js";
import type { MemoryEntry, MemorySearchResult } from "./types.js";
import type { LocalEmbeddingProvider } from "./embeddings-local.js";
import { MemoryStore } from "./store.js";
import { EmbeddingService } from "./embeddings.js";
import { hybridSearch } from "./search.js";

export class MemoryManager {
  private store: MemoryStore;
  private embeddingService: EmbeddingService | null = null;

  constructor(opts: {
    dbPath: string;
    apiProvider?: LLMProvider;
    localProvider?: LocalEmbeddingProvider;
    embeddingModel?: string;
  }) {
    this.store = new MemoryStore(opts.dbPath);

    if (opts.localProvider) {
      this.embeddingService = new EmbeddingService({
        localProvider: opts.localProvider,
        store: this.store,
      });
    } else if (opts.apiProvider) {
      this.embeddingService = new EmbeddingService({
        apiProvider: opts.apiProvider,
        model: opts.embeddingModel,
        store: this.store,
      });
    }
  }

  async index(entries: MemoryEntry[]): Promise<void> {
    const chunks = entries.map((e) => ({
      id: e.id || crypto.randomUUID(),
      content: e.content,
      source: e.source,
      session_id: e.sessionId ?? null,
      created_at: e.createdAt || new Date().toISOString(),
      metadata: JSON.stringify(e.metadata || {}),
      provider_model: null,
    }));

    this.store.insertChunks(chunks);

    if (this.embeddingService && chunks.length > 0) {
      try {
        await this.embeddingService.embed(chunks.map((c) => c.content));
      } catch {
        // Embedding failed, content is still indexed for FTS
      }
    }
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    return hybridSearch(this.store, this.embeddingService, query, limit);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    const rows = this.store.listRecent(limit);
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      source: row.source as MemoryEntry["source"],
      sessionId: row.session_id ?? undefined,
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    }));
  }

  async delete(id: string): Promise<void> {
    this.store.deleteChunk(id);
  }

  async clearEmbeddings(): Promise<void> {
    this.store.clearEmbeddings();
  }

  async clear(): Promise<void> {
    this.store.clearAll();
  }

  close(): void {
    this.store.close();
  }
}
