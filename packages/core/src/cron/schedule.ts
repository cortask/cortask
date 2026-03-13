import { Cron } from "croner";
import type { CronSchedule } from "./types.js";

/**
 * Compute the next run time in milliseconds for a given schedule.
 * Returns null if the schedule has no future run (e.g. one-shot in the past).
 */
export function computeNextRunAtMs(
  schedule: CronSchedule,
  now: number = Date.now(),
): number | null {
  switch (schedule.type) {
    case "at": {
      const target = new Date(schedule.datetime).getTime();
      return target > now ? target : null;
    }
    case "every": {
      // Next interval tick from now
      const interval = schedule.intervalMs;
      if (interval <= 0) return null;
      return now + interval;
    }
    case "cron": {
      try {
        const job = new Cron(schedule.expression, {
          timezone: schedule.timezone,
        });
        const next = job.nextRun();
        return next ? next.getTime() : null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

/**
 * Validate a cron expression. Returns null if valid, error message if not.
 */
export function validateCronExpr(expression: string): string | null {
  try {
    new Cron(expression);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid cron expression";
  }
}
