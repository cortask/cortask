import Database from "better-sqlite3";
import type { ModelStore } from "../models/store.js";
import { MODEL_DEFINITIONS } from "../models/definitions.js";

export interface UsageRecord {
  id: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  recordCount: number;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { input: number; output: number },
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export class UsageStore {
  private db: Database.Database;
  private modelStore: ModelStore;

  constructor(dbPath: string, modelStore: ModelStore) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.modelStore = modelStore;
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  record(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    let pricing = this.modelStore.getPricing(provider, model);
    if (!pricing) {
      // Fall back to hardcoded model definitions when model isn't in enabled_models
      const def = MODEL_DEFINITIONS[provider]?.find((m) => m.id === model);
      if (def?.inputPricePer1m != null && def?.outputPricePer1m != null) {
        pricing = { input: def.inputPricePer1m, output: def.outputPricePer1m };
      }
    }
    const costUsd = pricing
      ? estimateCost(inputTokens, outputTokens, pricing)
      : 0;
    this.db
      .prepare(
        `INSERT INTO usage_records (provider, model, input_tokens, output_tokens, cost_usd)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(provider, model, inputTokens, outputTokens, costUsd);
  }

  getSummary(period: "daily" | "weekly" | "monthly"): UsageSummary {
    const since = this.periodStart(period);
    const row = this.db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens), 0) as totalInputTokens,
          COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
          COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
          COALESCE(SUM(cost_usd), 0) as totalCostUsd,
          COUNT(*) as recordCount
        FROM usage_records
        WHERE created_at >= ?`,
      )
      .get(since) as UsageSummary;
    return row;
  }

  getHistory(days: number = 30): Array<{ date: string; tokens: number; costUsd: number }> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = this.db
      .prepare(
        `SELECT
          date(created_at) as date,
          SUM(input_tokens + output_tokens) as tokens,
          SUM(cost_usd) as costUsd
        FROM usage_records
        WHERE created_at >= ?
        GROUP BY date(created_at)
        ORDER BY date(created_at)`,
      )
      .all(since.toISOString()) as Array<{ date: string; tokens: number; costUsd: number }>;
    return rows;
  }

  private periodStart(period: "daily" | "weekly" | "monthly"): string {
    const now = new Date();
    switch (period) {
      case "daily":
        now.setHours(0, 0, 0, 0);
        break;
      case "weekly": {
        const day = now.getDay();
        now.setDate(now.getDate() - day);
        now.setHours(0, 0, 0, 0);
        break;
      }
      case "monthly":
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        break;
    }
    return now.toISOString();
  }
}
