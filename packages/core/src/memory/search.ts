import type { MemoryStore } from "./store.js";
import type { EmbeddingService } from "./embeddings.js";
import type { MemoryEntry, MemorySearchResult } from "./types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function bm25RankToScore(rank: number): number {
  return 1 / (1 + Math.abs(rank));
}

export async function hybridSearch(
  store: MemoryStore,
  embeddingService: EmbeddingService | null,
  query: string,
  limit: number
): Promise<MemorySearchResult[]> {
  const resultMap = new Map<string, MemorySearchResult>();

  // FTS search
  const ftsResults = store.searchFTS(query, limit * 2);
  for (const fts of ftsResults) {
    const entry = chunkToEntry(store.getChunk(fts.id));
    if (!entry) continue;

    resultMap.set(fts.id, {
      entry,
      score: bm25RankToScore(fts.rank),
      matchType: "fts",
    });
  }

  // Vector search (if embedding service available)
  if (embeddingService) {
    try {
      const queryEmbedding = await embeddingService.embedSingle(query);

      const allChunks = store.getAllChunks();
      if (allChunks.length > 0) {
        const chunkTexts = allChunks.map((c) => c.content);
        const embeddings = await embeddingService.embed(chunkTexts);

        const scored: { id: string; score: number }[] = [];
        for (let i = 0; i < allChunks.length; i++) {
          scored.push({
            id: allChunks[i].id,
            score: cosineSimilarity(queryEmbedding, embeddings[i]),
          });
        }

        scored.sort((a, b) => b.score - a.score);

        for (const item of scored.slice(0, limit * 2)) {
          const existing = resultMap.get(item.id);
          if (existing) {
            existing.score = Math.max(existing.score, item.score);
            existing.matchType = "hybrid";
          } else {
            const entry = chunkToEntry(store.getChunk(item.id));
            if (entry) {
              resultMap.set(item.id, {
                entry,
                score: item.score,
                matchType: "vector",
              });
            }
          }
        }
      }
    } catch {
      // Vector search failed, fall back to FTS only
    }
  }

  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function chunkToEntry(
  chunk: ReturnType<MemoryStore["getChunk"]>
): MemoryEntry | null {
  if (!chunk) return null;
  return {
    id: chunk.id,
    content: chunk.content,
    source: chunk.source as MemoryEntry["source"],
    sessionId: chunk.session_id ?? undefined,
    createdAt: chunk.created_at,
    metadata: JSON.parse(chunk.metadata) as Record<string, unknown>,
  };
}
