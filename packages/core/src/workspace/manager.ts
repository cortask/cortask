import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  lastAccessedAt: string;
  provider?: string;
  model?: string;
  skills?: string[];
}

const CORTASK_DIR = ".cortask";

export class WorkspaceManager {
  private db: Database.Database;
  private dataDir: string;
  private activeWorkspaceId: string | null = null;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.dataDir = path.dirname(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL UNIQUE,
        last_accessed_at TEXT NOT NULL,
        provider TEXT,
        model TEXT,
        skills TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS channel_workspace_map (
        chat_key TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
      )
    `);
    // Migration: add sort_order if missing
    const cols = this.db.pragma("table_info(workspaces)") as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "sort_order")) {
      this.db.exec("ALTER TABLE workspaces ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    }
  }

  async list(): Promise<Workspace[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM workspaces ORDER BY sort_order ASC, last_accessed_at DESC LIMIT 20",
      )
      .all() as Array<{
      id: string;
      name: string;
      root_path: string;
      last_accessed_at: string;
      provider: string | null;
      model: string | null;
      skills: string | null;
      sort_order: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      rootPath: r.root_path,
      lastAccessedAt: r.last_accessed_at,
      provider: r.provider ?? undefined,
      model: r.model ?? undefined,
      skills: r.skills ? JSON.parse(r.skills) : undefined,
    }));
  }

  async get(id: string): Promise<Workspace | null> {
    const row = this.db
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .get(id) as {
      id: string;
      name: string;
      root_path: string;
      last_accessed_at: string;
      provider: string | null;
      model: string | null;
      skills: string | null;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      lastAccessedAt: row.last_accessed_at,
      provider: row.provider ?? undefined,
      model: row.model ?? undefined,
      skills: row.skills ? JSON.parse(row.skills) : undefined,
    };
  }

  async create(name: string, rootPath?: string): Promise<Workspace> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const absPath = rootPath
      ? path.resolve(rootPath)
      : path.join(this.dataDir, "projects", id);

    // Ensure .cortask directory exists in the workspace
    const cortaskDir = path.join(absPath, CORTASK_DIR);
    await fs.mkdir(cortaskDir, { recursive: true });

    // Create default memory.md
    const memoryPath = path.join(cortaskDir, "memory.md");
    try {
      await fs.access(memoryPath);
    } catch {
      await fs.writeFile(
        memoryPath,
        "# Project Memory\n\nThis file is used by Cortask to remember important context about this project.\n",
        "utf-8",
      );
    }

    this.db
      .prepare(
        "INSERT INTO workspaces (id, name, root_path, last_accessed_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, name, absPath, now);

    return { id, name, rootPath: absPath, lastAccessedAt: now };
  }

  async update(
    id: string,
    updates: Partial<Pick<Workspace, "name" | "provider" | "model" | "skills">>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      values.push(updates.name);
    }
    if (updates.provider !== undefined) {
      sets.push("provider = ?");
      values.push(updates.provider);
    }
    if (updates.model !== undefined) {
      sets.push("model = ?");
      values.push(updates.model);
    }
    if (updates.skills !== undefined) {
      sets.push("skills = ?");
      values.push(JSON.stringify(updates.skills));
    }

    if (sets.length === 0) return;

    values.push(id);
    this.db
      .prepare(`UPDATE workspaces SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const update = this.db.prepare(
      "UPDATE workspaces SET sort_order = ? WHERE id = ?",
    );
    const transaction = this.db.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        update.run(i, orderedIds[i]);
      }
    });
    transaction();
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
  }

  async open(id: string): Promise<Workspace | null> {
    const workspace = await this.get(id);
    if (!workspace) return null;

    this.db
      .prepare("UPDATE workspaces SET last_accessed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);

    this.activeWorkspaceId = id;
    return workspace;
  }

  getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId;
  }

  async getActiveWorkspace(): Promise<Workspace | null> {
    if (!this.activeWorkspaceId) return null;
    return this.get(this.activeWorkspaceId);
  }

  async readMemory(workspacePath: string): Promise<string | undefined> {
    const memoryPath = path.join(workspacePath, CORTASK_DIR, "memory.md");
    try {
      return await fs.readFile(memoryPath, "utf-8");
    } catch {
      return undefined;
    }
  }

  async writeMemory(workspacePath: string, content: string): Promise<void> {
    const memoryPath = path.join(workspacePath, CORTASK_DIR, "memory.md");
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    await fs.writeFile(memoryPath, content, "utf-8");
  }

  async readGlobalMemory(dataDir: string): Promise<string | undefined> {
    const memoryPath = path.join(dataDir, "memory.md");
    try {
      return await fs.readFile(memoryPath, "utf-8");
    } catch {
      return undefined;
    }
  }

  async writeGlobalMemory(dataDir: string, content: string): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, "memory.md"), content, "utf-8");
  }

  getSessionDbPath(workspacePath: string): string {
    return path.join(workspacePath, CORTASK_DIR, "sessions.db");
  }

  getChannelWorkspace(chatKey: string): string | null {
    const row = this.db
      .prepare("SELECT workspace_id FROM channel_workspace_map WHERE chat_key = ?")
      .get(chatKey) as { workspace_id: string } | undefined;
    return row?.workspace_id ?? null;
  }

  setChannelWorkspace(chatKey: string, workspaceId: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO channel_workspace_map (chat_key, workspace_id) VALUES (?, ?)")
      .run(chatKey, workspaceId);
  }

  close(): void {
    this.db.close();
  }
}
