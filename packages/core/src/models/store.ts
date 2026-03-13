import Database from "better-sqlite3";

export interface EnabledModel {
  id: string;
  provider: string;
  modelId: string;
  label: string;
  inputPricePer1m: number;
  outputPricePer1m: number;
  enabledAt: string;
}

export class ModelStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS enabled_models (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        label TEXT NOT NULL,
        input_price_per_1m REAL NOT NULL DEFAULT 0,
        output_price_per_1m REAL NOT NULL DEFAULT 0,
        enabled_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(provider, model_id)
      )
    `);
  }

  list(provider?: string): EnabledModel[] {
    const query = provider
      ? "SELECT * FROM enabled_models WHERE provider = ? ORDER BY label"
      : "SELECT * FROM enabled_models ORDER BY provider, label";
    const rows = (provider
      ? this.db.prepare(query).all(provider)
      : this.db.prepare(query).all()) as Array<{
      id: string;
      provider: string;
      model_id: string;
      label: string;
      input_price_per_1m: number;
      output_price_per_1m: number;
      enabled_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      modelId: r.model_id,
      label: r.label,
      inputPricePer1m: r.input_price_per_1m,
      outputPricePer1m: r.output_price_per_1m,
      enabledAt: r.enabled_at,
    }));
  }

  enable(
    provider: string,
    modelId: string,
    label: string,
    inputPricePer1m: number,
    outputPricePer1m: number,
  ): EnabledModel {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO enabled_models (id, provider, model_id, label, input_price_per_1m, output_price_per_1m, enabled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, provider, modelId, label, inputPricePer1m, outputPricePer1m, now);
    return { id, provider, modelId, label, inputPricePer1m, outputPricePer1m, enabledAt: now };
  }

  disable(provider: string, modelId: string): void {
    this.db
      .prepare("DELETE FROM enabled_models WHERE provider = ? AND model_id = ?")
      .run(provider, modelId);
  }

  updatePricing(
    provider: string,
    modelId: string,
    inputPricePer1m: number,
    outputPricePer1m: number,
  ): void {
    this.db
      .prepare(
        "UPDATE enabled_models SET input_price_per_1m = ?, output_price_per_1m = ? WHERE provider = ? AND model_id = ?",
      )
      .run(inputPricePer1m, outputPricePer1m, provider, modelId);
  }

  getPricing(provider: string, modelId: string): { input: number; output: number } | null {
    const row = this.db
      .prepare("SELECT input_price_per_1m, output_price_per_1m FROM enabled_models WHERE provider = ? AND model_id = ?")
      .get(provider, modelId) as { input_price_per_1m: number; output_price_per_1m: number } | undefined;
    if (!row) return null;
    return { input: row.input_price_per_1m, output: row.output_price_per_1m };
  }
}
