import Database from "better-sqlite3";
import type { Message } from "../providers/types.js";

export type ChannelType = "whatsapp" | "telegram" | "discord";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  parentSessionId?: string;
  depth?: number;
  channel?: ChannelType;
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        parent_session_id TEXT,
        depth INTEGER DEFAULT 0,
        channel TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);
    `);

    // Note: Migrations are run at server startup via migrateSessionDatabase()
    // See packages/core/src/session/migrate.ts
  }

  listSessions(): Session[] {
    return this.db
      .prepare(
        "SELECT id, title, created_at as createdAt, updated_at as updatedAt, parent_session_id as parentSessionId, depth, channel FROM sessions ORDER BY updated_at DESC",
      )
      .all() as Session[];
  }

  getSession(id: string): SessionWithMessages | null {
    const session = this.db
      .prepare(
        "SELECT id, title, created_at as createdAt, updated_at as updatedAt, parent_session_id as parentSessionId, depth, channel FROM sessions WHERE id = ?",
      )
      .get(id) as Session | undefined;

    if (!session) return null;

    const rows = this.db
      .prepare(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
      )
      .all(id) as Array<{ role: string; content: string }>;

    const messages: Message[] = rows.map((r) => ({
      role: r.role as Message["role"],
      content: JSON.parse(r.content),
    }));

    return { ...session, messages };
  }

  createSession(id: string, title?: string, parentSessionId?: string, depth?: number, channel?: ChannelType): Session {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO sessions (id, title, created_at, updated_at, parent_session_id, depth, channel) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, title ?? "New Chat", now, now, parentSessionId ?? null, depth ?? 0, channel ?? null);

    return { id, title: title ?? "New Chat", createdAt: now, updatedAt: now, parentSessionId, depth, channel };
  }

  saveMessages(sessionId: string, messages: Message[], channel?: ChannelType): void {
    // Ensure session exists
    const exists = this.db
      .prepare("SELECT 1 FROM sessions WHERE id = ?")
      .get(sessionId);

    if (!exists) {
      this.createSession(sessionId, undefined, undefined, undefined, channel);
    }

    // Clear existing messages and re-insert all
    const transaction = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM messages WHERE session_id = ?")
        .run(sessionId);

      const insert = this.db.prepare(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      );

      const now = new Date().toISOString();
      for (const msg of messages) {
        insert.run(
          sessionId,
          msg.role,
          JSON.stringify(msg.content),
          now,
        );
      }

      this.db
        .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
        .run(now, sessionId);
    });

    transaction();
  }

  getMessages(sessionId: string): Message[] {
    const rows = this.db
      .prepare(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
      )
      .all(sessionId) as Array<{ role: string; content: string }>;

    return rows.map((r) => ({
      role: r.role as Message["role"],
      content: JSON.parse(r.content),
    }));
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  updateTitle(id: string, title: string): void {
    this.db
      .prepare("UPDATE sessions SET title = ? WHERE id = ?")
      .run(title, id);
  }

  close(): void {
    this.db.close();
  }
}
