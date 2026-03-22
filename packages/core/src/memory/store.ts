import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export interface ChunkRow {
  id: string;
  content: string;
  source: string;
  session_id: string | null;
  created_at: string;
  metadata: string;
  provider_model: string | null;
}

export class MemoryStore {
  private db: Database.Database;
  private ftsAvailable = false;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        session_id TEXT,
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        provider_model TEXT
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        content_hash TEXT PRIMARY KEY,
        provider_model TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
          id UNINDEXED,
          content,
          source UNINDEXED,
          content='chunks',
          content_rowid='rowid'
        );
      `);
      this.ftsAvailable = true;
    } catch {
      this.ftsAvailable = false;
    }

    if (this.ftsAvailable) {
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
          INSERT INTO chunks_fts(rowid, id, content, source)
          VALUES (new.rowid, new.id, new.content, new.source);
        END;
        CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
          INSERT INTO chunks_fts(chunks_fts, rowid, id, content, source)
          VALUES ('delete', old.rowid, old.id, old.content, old.source);
        END;
        CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
          INSERT INTO chunks_fts(chunks_fts, rowid, id, content, source)
          VALUES ('delete', old.rowid, old.id, old.content, old.source);
          INSERT INTO chunks_fts(rowid, id, content, source)
          VALUES (new.rowid, new.id, new.content, new.source);
        END;
      `);
    }
  }

  insertChunk(chunk: ChunkRow): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO chunks (id, content, source, session_id, created_at, metadata, provider_model)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chunk.id,
        chunk.content,
        chunk.source,
        chunk.session_id,
        chunk.created_at,
        chunk.metadata,
        chunk.provider_model
      );
  }

  insertChunks(chunks: ChunkRow[]): void {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO chunks (id, content, source, session_id, created_at, metadata, provider_model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = this.db.transaction((items: ChunkRow[]) => {
      for (const chunk of items) {
        insert.run(
          chunk.id,
          chunk.content,
          chunk.source,
          chunk.session_id,
          chunk.created_at,
          chunk.metadata,
          chunk.provider_model
        );
      }
    });
    tx(chunks);
  }

  searchFTS(query: string, limit: number): Array<{ id: string; content: string; source: string; rank: number }> {
    if (!this.ftsAvailable) return [];

    const sanitized = query.replace(/[^\w\s]/g, " ").trim();
    if (!sanitized) return [];

    const ftsQuery = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `"${w}"`)
      .join(" OR ");

    try {
      return this.db
        .prepare(
          `SELECT id, content, source, rank
           FROM chunks_fts
           WHERE chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(ftsQuery, limit) as Array<{ id: string; content: string; source: string; rank: number }>;
    } catch {
      return [];
    }
  }

  getChunk(id: string): ChunkRow | null {
    return (
      (this.db.prepare("SELECT * FROM chunks WHERE id = ?").get(id) as ChunkRow | undefined) ??
      null
    );
  }

  listRecent(limit: number): ChunkRow[] {
    return this.db
      .prepare("SELECT * FROM chunks ORDER BY created_at DESC LIMIT ?")
      .all(limit) as ChunkRow[];
  }

  getAllChunks(): ChunkRow[] {
    return this.db.prepare("SELECT * FROM chunks").all() as ChunkRow[];
  }

  deleteChunk(id: string): void {
    this.db.prepare("DELETE FROM chunks WHERE id = ?").run(id);
  }

  clearAll(): void {
    this.db.exec("DELETE FROM chunks");
    if (this.ftsAvailable) {
      this.db.exec("DELETE FROM chunks_fts");
    }
    this.db.exec("DELETE FROM embedding_cache");
  }

  clearEmbeddings(): void {
    this.db.exec("DELETE FROM embedding_cache");
  }

  getCachedEmbedding(contentHash: string, providerModel: string): number[] | null {
    const row = this.db
      .prepare(
        "SELECT embedding FROM embedding_cache WHERE content_hash = ? AND provider_model = ?"
      )
      .get(contentHash, providerModel) as { embedding: Buffer } | undefined;

    if (!row) return null;
    return Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
  }

  setCachedEmbedding(contentHash: string, providerModel: string, embedding: number[]): void {
    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO embedding_cache (content_hash, provider_model, embedding, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(contentHash, providerModel, buffer, new Date().toISOString());
  }

  get isFTSAvailable(): boolean {
    return this.ftsAvailable;
  }

  close(): void {
    this.db.close();
  }
}
