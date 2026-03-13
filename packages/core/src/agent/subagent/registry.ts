import type { SubagentRunRecord } from "./types.js";

const activeRuns = new Map<string, SubagentRunRecord>();

/**
 * Register a new subagent run in the registry.
 */
export function registerSubagentRun(record: SubagentRunRecord): void {
  activeRuns.set(record.runId, record);
}

/**
 * Retrieve a subagent run by its ID.
 */
export function getSubagentRun(runId: string): SubagentRunRecord | undefined {
  return activeRuns.get(runId);
}

/**
 * Mark a subagent run as complete with result or error.
 */
export function completeSubagentRun(
  runId: string,
  status: "done" | "error" | "timeout" | "cancelled",
  result?: string,
  error?: string,
): void {
  const record = activeRuns.get(runId);
  if (record) {
    record.status = status;
    record.result = result;
    record.error = error;
    record.endedAt = Date.now();
    // Clean up abort controller
    delete record.abortController;
  }
}

/**
 * Cancel a subagent run and all its children.
 */
export function cancelSubagentRun(runId: string): boolean {
  const record = activeRuns.get(runId);
  if (!record) return false;

  // Abort the controller if it exists
  if (record.abortController && !record.abortController.signal.aborted) {
    record.abortController.abort();
  }

  // Mark as cancelled
  completeSubagentRun(runId, "cancelled", undefined, "Cancelled by user or parent");

  // Recursively cancel children
  for (const [childRunId, childRecord] of activeRuns) {
    if (childRecord.parentSessionId === record.childSessionId && childRecord.status === "running") {
      cancelSubagentRun(childRunId);
    }
  }

  return true;
}

/**
 * Cancel all children of a parent session.
 */
export function cancelChildrenOfSession(parentSessionId: string): number {
  let count = 0;
  for (const [runId, record] of activeRuns) {
    if (record.parentSessionId === parentSessionId && record.status === "running") {
      if (cancelSubagentRun(runId)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Count how many active (running) children belong to a parent session.
 */
export function countActiveChildren(parentSessionId: string): number {
  let count = 0;
  for (const r of activeRuns.values()) {
    if (r.parentSessionId === parentSessionId && r.status === "running") {
      count++;
    }
  }
  return count;
}

/**
 * Get the depth of a session (0 for root, 1+ for subagents).
 */
export function getDepthForSession(sessionId: string): number {
  for (const r of activeRuns.values()) {
    if (r.childSessionId === sessionId) {
      return r.depth;
    }
  }
  return 0;
}

/**
 * Cleanup old completed subagent records.
 * @param maxAgeMs Maximum age in milliseconds (default: 30 minutes)
 */
export function cleanupSubagentRecords(maxAgeMs = 30 * 60 * 1000): void {
  const now = Date.now();
  for (const [runId, record] of activeRuns) {
    if (
      record.status !== "running" &&
      record.endedAt &&
      now - record.endedAt > maxAgeMs
    ) {
      activeRuns.delete(runId);
    }
  }
}
