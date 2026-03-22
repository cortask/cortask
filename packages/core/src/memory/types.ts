export interface MemoryEntry {
  id: string;
  content: string;
  source: "conversation" | "manual" | "agent";
  sessionId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  matchType: "vector" | "fts" | "hybrid";
}
