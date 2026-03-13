import crypto from "node:crypto";
import Database from "better-sqlite3";
import { computeNextRunAtMs } from "./schedule.js";
import { logger } from "../logging/logger.js";
import type {
  CronJob,
  CronJobCreate,
  CronJobState,
  CronSchedule,
  CronEvent,
} from "./types.js";

const MAX_TIMER_DELAY_MS = 60_000;
const MIN_REFIRE_GAP_MS = 2_000;
const ERROR_BACKOFF_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];

type EventHandler = (event: CronEvent) => void;
type JobExecutor = (job: CronJob) => Promise<string>;

export class CronService {
  private db: Database.Database;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private executor: JobExecutor | null = null;
  private eventHandlers: EventHandler[] = [];

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        schedule TEXT NOT NULL,
        prompt TEXT NOT NULL,
        delivery TEXT NOT NULL DEFAULT '{}',
        workspace_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cron_job_states (
        job_id TEXT PRIMARY KEY REFERENCES cron_jobs(id) ON DELETE CASCADE,
        next_run_at_ms INTEGER,
        last_run_at_ms INTEGER,
        last_status TEXT,
        last_error TEXT,
        consecutive_errors INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  setExecutor(executor: JobExecutor): void {
    this.executor = executor;
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: CronEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info("Cron service started", "cron");

    // Compute initial next-run for all enabled jobs missing a next_run_at_ms
    const jobs = this.list();
    for (const job of jobs) {
      if (!job.enabled) continue;
      const state = this.getState(job.id);
      if (!state || state.nextRunAtMs === null) {
        const nextMs = computeNextRunAtMs(job.schedule);
        this.upsertState(job.id, { nextRunAtMs: nextMs });
      }
    }

    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Cron service stopped", "cron");
  }

  private scheduleNext(): void {
    if (!this.running) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Find the soonest job
    const row = this.db
      .prepare(
        `SELECT s.job_id, s.next_run_at_ms
         FROM cron_job_states s
         JOIN cron_jobs j ON j.id = s.job_id
         WHERE j.enabled = 1 AND s.next_run_at_ms IS NOT NULL
         ORDER BY s.next_run_at_ms ASC
         LIMIT 1`,
      )
      .get() as { job_id: string; next_run_at_ms: number } | undefined;

    if (!row) return;

    const delayMs = Math.max(0, row.next_run_at_ms - Date.now());
    const clampedDelay = Math.min(delayMs, MAX_TIMER_DELAY_MS);

    this.timer = setTimeout(() => {
      this.tick();
    }, clampedDelay);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;

    const now = Date.now();

    // Get all jobs due to run
    const dueRows = this.db
      .prepare(
        `SELECT s.job_id
         FROM cron_job_states s
         JOIN cron_jobs j ON j.id = s.job_id
         WHERE j.enabled = 1
           AND s.next_run_at_ms IS NOT NULL
           AND s.next_run_at_ms <= ?`,
      )
      .all(now) as Array<{ job_id: string }>;

    for (const { job_id } of dueRows) {
      await this.executeJob(job_id);
    }

    this.scheduleNext();
  }

  private async executeJob(jobId: string): Promise<void> {
    const job = this.getJob(jobId);
    if (!job || !this.executor) return;

    const state = this.getState(jobId);
    if (state?.lastRunAtMs && Date.now() - state.lastRunAtMs < MIN_REFIRE_GAP_MS) {
      return;
    }

    this.emit({
      type: "started",
      jobId: job.id,
      jobName: job.name,
    });

    try {
      const result = await this.executor(job);

      this.upsertState(jobId, {
        lastRunAtMs: Date.now(),
        lastStatus: "success",
        lastError: null,
        consecutiveErrors: 0,
        nextRunAtMs: computeNextRunAtMs(job.schedule),
      });

      this.emit({
        type: "finished",
        jobId: job.id,
        jobName: job.name,
        result,
      });

      logger.info(`Cron job "${job.name}" completed`, "cron");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const currentErrors = (state?.consecutiveErrors ?? 0) + 1;
      const backoffIdx = Math.min(currentErrors - 1, ERROR_BACKOFF_MS.length - 1);
      const backoffMs = ERROR_BACKOFF_MS[backoffIdx];

      this.upsertState(jobId, {
        lastRunAtMs: Date.now(),
        lastStatus: "error",
        lastError: errorMsg,
        consecutiveErrors: currentErrors,
        nextRunAtMs: Date.now() + backoffMs,
      });

      this.emit({
        type: "error",
        jobId: job.id,
        jobName: job.name,
        error: errorMsg,
      });

      logger.error(
        `Cron job "${job.name}" failed (${currentErrors} errors): ${errorMsg}`,
        "cron",
      );
    }
  }

  // CRUD

  add(input: CronJobCreate): CronJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: CronJob = {
      id,
      name: input.name,
      enabled: input.enabled ?? true,
      schedule: input.schedule,
      prompt: input.prompt,
      delivery: input.delivery ?? {},
      workspaceId: input.workspaceId,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO cron_jobs (id, name, enabled, schedule, prompt, delivery, workspace_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id,
        job.name,
        job.enabled ? 1 : 0,
        JSON.stringify(job.schedule),
        job.prompt,
        JSON.stringify(job.delivery),
        job.workspaceId ?? null,
        job.createdAt,
        job.updatedAt,
      );

    // Set initial state
    const nextMs = job.enabled ? computeNextRunAtMs(job.schedule) : null;
    this.upsertState(id, { nextRunAtMs: nextMs });

    this.emit({ type: "added", jobId: id, jobName: job.name });

    if (this.running) this.scheduleNext();

    return job;
  }

  update(
    id: string,
    updates: Partial<Pick<CronJob, "name" | "enabled" | "schedule" | "prompt" | "delivery">>,
  ): CronJob | null {
    const existing = this.getJob(id);
    if (!existing) return null;

    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      values.push(updates.name);
    }
    if (updates.enabled !== undefined) {
      sets.push("enabled = ?");
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.schedule !== undefined) {
      sets.push("schedule = ?");
      values.push(JSON.stringify(updates.schedule));
    }
    if (updates.prompt !== undefined) {
      sets.push("prompt = ?");
      values.push(updates.prompt);
    }
    if (updates.delivery !== undefined) {
      sets.push("delivery = ?");
      values.push(JSON.stringify(updates.delivery));
    }

    values.push(id);
    this.db
      .prepare(`UPDATE cron_jobs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);

    // Recompute next run if schedule or enabled changed
    if (updates.schedule !== undefined || updates.enabled !== undefined) {
      const updated = this.getJob(id)!;
      const nextMs = updated.enabled ? computeNextRunAtMs(updated.schedule) : null;
      this.upsertState(id, { nextRunAtMs: nextMs, consecutiveErrors: 0 });
    }

    if (this.running) this.scheduleNext();

    return this.getJob(id);
  }

  remove(id: string): boolean {
    const job = this.getJob(id);
    if (!job) return false;

    this.db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(id);
    this.emit({ type: "removed", jobId: id, jobName: job.name });

    if (this.running) this.scheduleNext();
    return true;
  }

  getJob(id: string): CronJob | null {
    const row = this.db
      .prepare("SELECT * FROM cron_jobs WHERE id = ?")
      .get(id) as CronJobRow | undefined;

    return row ? rowToJob(row) : null;
  }

  list(workspaceId?: string): CronJob[] {
    let rows: CronJobRow[];
    if (workspaceId) {
      rows = this.db
        .prepare(
          "SELECT * FROM cron_jobs WHERE workspace_id = ? ORDER BY created_at DESC",
        )
        .all(workspaceId) as CronJobRow[];
    } else {
      rows = this.db
        .prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC")
        .all() as CronJobRow[];
    }
    return rows.map(rowToJob);
  }

  getState(jobId: string): CronJobState | null {
    const row = this.db
      .prepare("SELECT * FROM cron_job_states WHERE job_id = ?")
      .get(jobId) as {
      job_id: string;
      next_run_at_ms: number | null;
      last_run_at_ms: number | null;
      last_status: string | null;
      last_error: string | null;
      consecutive_errors: number;
    } | undefined;

    if (!row) return null;

    return {
      jobId: row.job_id,
      nextRunAtMs: row.next_run_at_ms,
      lastRunAtMs: row.last_run_at_ms,
      lastStatus: row.last_status as "success" | "error" | null,
      lastError: row.last_error,
      consecutiveErrors: row.consecutive_errors,
    };
  }

  async runNow(id: string): Promise<void> {
    await this.executeJob(id);
    if (this.running) this.scheduleNext();
  }

  private upsertState(
    jobId: string,
    partial: Partial<Omit<CronJobState, "jobId">>,
  ): void {
    const existing = this.getState(jobId);

    if (existing) {
      const sets: string[] = [];
      const values: unknown[] = [];

      if (partial.nextRunAtMs !== undefined) {
        sets.push("next_run_at_ms = ?");
        values.push(partial.nextRunAtMs);
      }
      if (partial.lastRunAtMs !== undefined) {
        sets.push("last_run_at_ms = ?");
        values.push(partial.lastRunAtMs);
      }
      if (partial.lastStatus !== undefined) {
        sets.push("last_status = ?");
        values.push(partial.lastStatus);
      }
      if (partial.lastError !== undefined) {
        sets.push("last_error = ?");
        values.push(partial.lastError);
      }
      if (partial.consecutiveErrors !== undefined) {
        sets.push("consecutive_errors = ?");
        values.push(partial.consecutiveErrors);
      }

      if (sets.length > 0) {
        values.push(jobId);
        this.db
          .prepare(
            `UPDATE cron_job_states SET ${sets.join(", ")} WHERE job_id = ?`,
          )
          .run(...values);
      }
    } else {
      this.db
        .prepare(
          `INSERT INTO cron_job_states (job_id, next_run_at_ms, last_run_at_ms, last_status, last_error, consecutive_errors)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          jobId,
          partial.nextRunAtMs ?? null,
          partial.lastRunAtMs ?? null,
          partial.lastStatus ?? null,
          partial.lastError ?? null,
          partial.consecutiveErrors ?? 0,
        );
    }
  }

  close(): void {
    this.stop();
    this.db.close();
  }
}

// Internal helpers

interface CronJobRow {
  id: string;
  name: string;
  enabled: number;
  schedule: string;
  prompt: string;
  delivery: string;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: CronJobRow): CronJob {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    schedule: JSON.parse(row.schedule) as CronSchedule,
    prompt: row.prompt,
    delivery: JSON.parse(row.delivery),
    workspaceId: row.workspace_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
