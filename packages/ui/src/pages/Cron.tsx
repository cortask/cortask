import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { api, type CronJobWithState, type CronSchedule, type Workspace } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { emitCronChange } from "@/lib/events";
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
import { Check } from "lucide-react";

export function CronPage() {
  const [jobs, setJobs] = useState<CronJobWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>("all");
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open create form when navigated with ?create=workspaceId
  const createForWorkspace = searchParams.get("create");
  useEffect(() => {
    if (createForWorkspace) {
      setShowCreate(true);
      // Clear the query param so it doesn't persist on refresh
      setSearchParams({}, { replace: true });
    }
  }, [createForWorkspace, setSearchParams]);

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
      emitCronChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await api.cron.update(id, { enabled: !enabled });
      await fetchJobs();
      emitCronChange();
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
      <div className="flex items-center justify-between gap-3 mb-6">
        <Select value={filterWorkspaceId} onValueChange={setFilterWorkspaceId}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          workspaces={workspaces}
          initialWorkspaceId={createForWorkspace ?? undefined}
          onCreated={() => {
            setShowCreate(false);
            fetchJobs();
            emitCronChange();
          }}
          onError={setError}
        />
      )}

      <div className="space-y-3">
        {(filterWorkspaceId === "all"
          ? jobs
          : jobs.filter((j) => j.workspaceId === filterWorkspaceId)
        ).map((job) => (
          <JobCard
            key={job.id}
            job={job}
            workspaces={workspaces}
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
  workspaces,
  onToggle,
  onDelete,
  onRunNow,
}: {
  job: CronJobWithState;
  workspaces: Workspace[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onRunNow: (id: string) => void;
}) {
  const scheduleText = formatSchedule(job.schedule);
  const workspaceName = job.workspaceId
    ? workspaces.find((w) => w.id === job.workspaceId)?.name ?? "Unknown"
    : null;
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
              {workspaceName ? (
                <Badge variant="outline" className="text-[10px]">
                  {workspaceName}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Global
                </Badge>
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
  workspaces,
  initialWorkspaceId,
  onCreated,
  onError,
}: {
  workspaces: Workspace[];
  initialWorkspaceId?: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId ?? "none");
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduleType, setScheduleType] = useState<"cron" | "at">("cron");
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [naturalLang, setNaturalLang] = useState("");
  const [converting, setConverting] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConvert() {
    if (!naturalLang.trim()) return;
    setConverting(true);
    try {
      const now = new Date().toISOString();
      const result = await api.llm.complete(
        `You convert schedule descriptions to either a cron expression or an ISO 8601 datetime.

Rules:
- If the description is a recurring schedule (e.g. "every monday at 10am", "daily at 9"), reply with: CRON <5-field cron expression>
- If the description is a one-time event (e.g. "in 10 minutes", "tomorrow at 3pm", "on March 25 at noon"), reply with: AT <ISO 8601 datetime>

Reply with ONLY "CRON <expression>" or "AT <datetime>". No explanation, no backticks.
The current time is: ${now}

Schedule: "${naturalLang}"`
      );
      const response = result.response.trim();
      if (response.startsWith("AT ")) {
        setScheduleType("at");
        setScheduleValue(response.slice(3).trim());
        setScheduleLabel(new Date(response.slice(3).trim()).toLocaleString());
      } else {
        setScheduleType("cron");
        const expr = response.startsWith("CRON ") ? response.slice(5).trim() : response;
        setScheduleValue(expr);
        setScheduleLabel(expr);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to convert schedule");
    } finally {
      setConverting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !prompt || !scheduleValue) return;

    setSubmitting(true);
    try {
      const schedule: CronSchedule = scheduleType === "at"
        ? { type: "at", datetime: scheduleValue }
        : { type: "cron", expression: scheduleValue };

      await api.cron.create({
        name,
        prompt,
        schedule,
        workspaceId: selectedWorkspaceId !== "none" ? selectedWorkspaceId : undefined,
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
            <Label>Project</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger>
                <SelectValue placeholder="None (Global)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Global)</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label>Schedule</Label>
            <div className="flex gap-2">
              <Input
                value={naturalLang}
                onChange={(e) => setNaturalLang(e.target.value)}
                placeholder="Every monday at 10am"
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={converting || !naturalLang.trim()}
                onClick={handleConvert}
              >
                {converting ? "Converting..." : "Convert"}
              </Button>
            </div>
            {scheduleValue && (
              <div className="flex items-center gap-2 text-xs text-green-500">
                <Check className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {scheduleType === "at" ? `one-time: ${scheduleLabel}` : scheduleLabel}
                </span>
              </div>
            )}
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
