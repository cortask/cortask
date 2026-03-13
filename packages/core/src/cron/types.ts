export interface CronScheduleAt {
  type: "at";
  datetime: string; // ISO 8601
}

export interface CronScheduleEvery {
  type: "every";
  intervalMs: number;
}

export interface CronScheduleCron {
  type: "cron";
  expression: string;
  timezone?: string;
}

export type CronSchedule = CronScheduleAt | CronScheduleEvery | CronScheduleCron;

export interface CronDelivery {
  channel?: string;   // e.g. "telegram"
  target?: string;    // e.g. chat ID
  sessionKey?: string; // deliver to a WS session
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  prompt: string;
  delivery: CronDelivery;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobState {
  jobId: string;
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: "success" | "error" | null;
  lastError: string | null;
  consecutiveErrors: number;
}

export interface CronJobCreate {
  name: string;
  schedule: CronSchedule;
  prompt: string;
  delivery?: CronDelivery;
  workspaceId?: string;
  enabled?: boolean;
}

export interface CronEvent {
  type: "added" | "removed" | "started" | "finished" | "error";
  jobId: string;
  jobName: string;
  result?: string;
  error?: string;
}
