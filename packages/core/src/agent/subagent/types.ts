export interface SubagentRunRecord {
  runId: string;
  childSessionId: string; // Format: "subagent:{runId}"
  parentSessionId: string;
  parentRunId: string;
  task: string;
  depth: number; // 0=root, 1=child
  status: "running" | "done" | "error" | "timeout" | "cancelled";
  result?: string;
  error?: string;
  createdAt: number;
  endedAt?: number;
  abortController?: AbortController; // For cancellation
}

export const SUBAGENT_DEFAULTS = {
  maxDepth: 1,
  maxChildrenPerAgent: 5,
  timeoutMs: 120_000, // 2 minutes
} as const;
