import { useState, useEffect, useCallback } from "react";
import { api, type CronJobWithState, type CronSchedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CronPage() {
  const [jobs, setJobs] = useState<CronJobWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.cron.list();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete cron job "${name}"?`)) return;
    try {
      await api.cron.delete(id);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await api.cron.update(id, { enabled: !enabled });
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    }
  }

  async function handleRunNow(id: string) {
    try {
      await api.cron.runNow(id);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run job");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading cron jobs...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-6">
      <div className="flex items-center justify-end mb-6">
        <Button
          variant="secondary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "+ New Job"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive-foreground text-sm">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {showCreate && (
        <CreateJobForm
          onCreated={() => {
            setShowCreate(false);
            fetchJobs();
          }}
          onError={setError}
        />
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onRunNow={handleRunNow}
          />
        ))}
        {jobs.length === 0 && !showCreate && (
          <p className="text-muted-foreground text-sm">
            No cron jobs. Create one to schedule automated tasks.
          </p>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  onToggle,
  onDelete,
  onRunNow,
}: {
  job: CronJobWithState;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onRunNow: (id: string) => void;
}) {
  const scheduleText = formatSchedule(job.schedule);
  const nextRun = job.state?.nextRunAtMs
    ? new Date(job.state.nextRunAtMs).toLocaleString()
    : "—";
  const lastRun = job.state?.lastRunAtMs
    ? new Date(job.state.lastRunAtMs).toLocaleString()
    : "Never";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{job.name}</h3>
              {job.enabled ? (
                <Badge className="bg-green-900/40 text-green-400 border-green-800 hover:bg-green-900/40">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
              {job.state?.lastStatus === "error" && (
                <Badge variant="destructive">
                  Error ({job.state.consecutiveErrors}x)
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {scheduleText}
              {job.delivery?.channel && (
                <span className="ml-2 text-blue-400">
                  → {job.delivery.channel}:{job.delivery.target}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {job.prompt}
            </p>
          </div>

          <div className="flex items-center gap-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRunNow(job.id)}
              title="Run now"
            >
              Run
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggle(job.id, job.enabled)}
            >
              {job.enabled ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(job.id, job.name)}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span>Next: {nextRun}</span>
          <span>Last: {lastRun}</span>
          {job.state?.lastError && (
            <span
              className="text-destructive truncate max-w-xs"
              title={job.state.lastError}
            >
              {job.state.lastError}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateJobForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [scheduleType, setScheduleType] = useState<"cron" | "every" | "at">(
    "cron",
  );
  const [scheduleValue, setScheduleValue] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !prompt || !scheduleValue) return;

    setSubmitting(true);
    try {
      let schedule: CronSchedule;
      switch (scheduleType) {
        case "cron":
          schedule = { type: "cron", expression: scheduleValue };
          break;
        case "every":
          schedule = { type: "every", intervalMs: parseInt(scheduleValue, 10) };
          break;
        case "at":
          schedule = { type: "at", datetime: scheduleValue };
          break;
      }

      await api.cron.create({
        name,
        prompt,
        schedule,
        ...(deliveryChannel && deliveryChannel !== "none" && deliveryTarget
          ? { delivery: { channel: deliveryChannel, target: deliveryTarget } }
          : {}),
      });
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily summary"
            />
          </div>

          <div className="space-y-1">
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Summarize today's changes in the project..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="w-32 space-y-1">
              <Label>Type</Label>
              <Select
                value={scheduleType}
                onValueChange={(v) =>
                  setScheduleType(v as "cron" | "every" | "at")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cron">Cron</SelectItem>
                  <SelectItem value="every">Interval</SelectItem>
                  <SelectItem value="at">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>
                {scheduleType === "cron"
                  ? "Cron Expression"
                  : scheduleType === "every"
                    ? "Interval (ms)"
                    : "DateTime (ISO)"}
              </Label>
              <Input
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                placeholder={
                  scheduleType === "cron"
                    ? "0 9 * * *"
                    : scheduleType === "every"
                      ? "3600000"
                      : "2026-03-04T09:00:00Z"
                }
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-40 space-y-1">
              <Label>Delivery Channel</Label>
              <Select
                value={deliveryChannel}
                onValueChange={setDeliveryChannel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deliveryChannel && deliveryChannel !== "none" && (
              <div className="flex-1 space-y-1">
                <Label>Chat ID / Target</Label>
                <Input
                  value={deliveryTarget}
                  onChange={(e) => setDeliveryTarget(e.target.value)}
                  placeholder="Chat ID or user ID"
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting || !name || !prompt || !scheduleValue}
          >
            {submitting ? "Creating..." : "Create Job"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.type) {
    case "cron":
      return `cron: ${schedule.expression}${schedule.timezone ? ` (${schedule.timezone})` : ""}`;
    case "every":
      return `every ${formatInterval(schedule.intervalMs ?? 0)}`;
    case "at":
      return `at ${schedule.datetime}`;
    default:
      return JSON.stringify(schedule);
  }
}

function formatInterval(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  if (ms < 86400000) return `${ms / 3600000}h`;
  return `${ms / 86400000}d`;
}
