import Database from "better-sqlite3";

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: Array<{ name: string; content: string; category: string }> = [
  { name: "Summarize", content: "Summarize the following:\n\n", category: "General" },
  { name: "Explain code", content: "Explain this code in detail:\n\n", category: "Development" },
  { name: "Write email", content: "Write a professional email about:\n\n", category: "Writing" },
  { name: "Fix bug", content: "Help me fix this bug:\n\n", category: "Development" },
  { name: "Brainstorm", content: "Brainstorm ideas for:\n\n", category: "General" },
];

export class TemplateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Seed defaults if table is empty
    const count = this.db
      .prepare("SELECT COUNT(*) as cnt FROM prompt_templates")
      .get() as { cnt: number };

    if (count.cnt === 0) {
      const insert = this.db.prepare(
        "INSERT INTO prompt_templates (id, name, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      const now = new Date().toISOString();
      for (const t of DEFAULT_TEMPLATES) {
        insert.run(crypto.randomUUID(), t.name, t.content, t.category, now, now);
      }
    }
  }

  list(): PromptTemplate[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, content, category, created_at, updated_at FROM prompt_templates ORDER BY category, name",
      )
      .all() as Array<{
      id: string;
      name: string;
      content: string;
      category: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      category: r.category,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  get(id: string): PromptTemplate | null {
    const row = this.db
      .prepare(
        "SELECT id, name, content, category, created_at, updated_at FROM prompt_templates WHERE id = ?",
      )
      .get(id) as {
      id: string;
      name: string;
      content: string;
      category: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      content: row.content,
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(name: string, content: string, category?: string): PromptTemplate {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO prompt_templates (id, name, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, name, content, category ?? "General", now, now);

    return { id, name, content, category: category ?? "General", createdAt: now, updatedAt: now };
  }

  update(id: string, data: Partial<Pick<PromptTemplate, "name" | "content" | "category">>): PromptTemplate | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const content = data.content ?? existing.content;
    const category = data.category ?? existing.category;

    this.db
      .prepare(
        "UPDATE prompt_templates SET name = ?, content = ?, category = ?, updated_at = ? WHERE id = ?",
      )
      .run(name, content, category, now, id);

    return { id, name, content, category, createdAt: existing.createdAt, updatedAt: now };
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM prompt_templates WHERE id = ?").run(id);
  }
}
