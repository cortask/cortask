import { useEffect, useState, useCallback, useRef } from "react";
import { api, type Provider, type AppConfig, type UsageSummary, type AvailableModel, type EnabledModel, type UpdateInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Cpu,
  Plug,
  Unplug,
  Check,
  FlaskConical,
  Bot,
  Server,
  Save,
  RotateCcw,
  Wallet,
  Plus,
  Trash2,
  Loader2,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const isDesktop = !!(window as any).cortask;

const tabs = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "spending", label: "Spending", icon: Wallet },
  { id: "providers", label: "AI Providers", icon: Cpu },
  { id: "server", label: "Server", icon: Server },
  { id: "updates", label: "Updates", icon: Download },
] as const;

type TabId = "agent" | "spending" | "providers" | "server" | "updates";

interface UpdateStatus {
  status: "idle" | "checking" | "available" | "up-to-date" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  error?: string;
}

const ALL_PROVIDERS = [
  { id: "anthropic", name: "Anthropic", logo: "/logos/anthropic.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
  { id: "openai", name: "OpenAI", logo: "/logos/openai.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
  { id: "google", name: "Google", logo: "/logos/google.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
  { id: "moonshot", name: "Moonshot", logo: "/logos/moonshot.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
  { id: "grok", name: "Grok", logo: "/logos/grok.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
  { id: "openrouter", name: "OpenRouter", logo: "/logos/openrouter.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: true },
  { id: "minimax", name: "MiniMax", logo: "/logos/minimax.svg", fieldLabel: "API Key", fieldType: "password" as const, darkInvert: false },
  { id: "ollama", name: "Ollama", logo: "/logos/ollama.svg", fieldLabel: "Host URL", fieldType: "text" as const, darkInvert: true },
] as const;

const TOKEN_PRESETS = [
  { label: "1K", value: 1024 },
  { label: "4K", value: 4096 },
  { label: "8K", value: 8192 },
  { label: "16K", value: 16384 },
  { label: "32K", value: 32768 },
  { label: "64K", value: 65536 },
  { label: "128K", value: 131072 },
];

const MAX_TOKEN_LIMIT = 131072;

const COST_PRESETS = [
  { label: "$1", value: 1 },
  { label: "$5", value: 5 },
  { label: "$10", value: 10 },
  { label: "$25", value: 25 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("agent");

  // Provider state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  // Config state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasTokenLimit, setHasTokenLimit] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Model state
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [customModel, setCustomModel] = useState({ id: "", name: "", inputPrice: 0, outputPrice: 0 });
  const [showCustom, setShowCustom] = useState(false);

  // Usage state (usagePeriod is just for the overview card, independent from spending limit period)
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usagePeriod, setUsagePeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  // Separate summary for spending limit progress (always follows the configured limit period)
  const [limitUsage, setLimitUsage] = useState<UsageSummary | null>(null);

  // Updater state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle" });
  const [appVersion, setAppVersion] = useState<string>("unknown");
  const [webUpdateInfo, setWebUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (isDesktop) {
      const cortask = (window as any).cortask;
      cortask?.getVersion?.().then((v: string) => setAppVersion(v));
      const cleanup = cortask?.updater?.onStatus((data: UpdateStatus) => {
        setUpdateStatus(data);
      });
      return () => cleanup?.();
    } else {
      // Web mode: fetch version from health endpoint
      fetch("/api/health").then(r => r.json()).then((data: { version: string }) => {
        setAppVersion(data.version);
      }).catch(() => {});
    }
  }, []);

  const checkForUpdates = async () => {
    if (isDesktop) {
      setUpdateStatus({ status: "checking" });
      try {
        const cortask = (window as any).cortask;
        await cortask?.updater?.check();
      } catch {
        setUpdateStatus({ status: "error", error: "Failed to check for updates" });
      }
    } else {
      setUpdateStatus({ status: "checking" });
      try {
        const info = await api.updates.check();
        setWebUpdateInfo(info);
        setAppVersion(info.currentVersion);
        setUpdateStatus({ status: info.hasUpdate ? "available" : "up-to-date", version: info.latestVersion ?? undefined });
      } catch {
        setUpdateStatus({ status: "error", error: "Failed to check for updates" });
      }
    }
  };

  const downloadUpdate = async () => {
    try {
      const cortask = (window as any).cortask;
      await cortask?.updater?.download();
    } catch {
      setUpdateStatus({ status: "error", error: "Failed to download update" });
    }
  };

  const installUpdate = async () => {
    const cortask = (window as any).cortask;
    await cortask?.updater?.install();
  };

  const loadData = useCallback(async () => {
    try {
      const [provs, cfg] = await Promise.all([
        api.providers.list(),
        api.config.get(),
      ]);
      setProviders(provs);
      setConfig(cfg);
      setConfigDraft(cfg);
      setHasTokenLimit(cfg.agent.maxTokens !== undefined);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadModels = useCallback(async (providerId: string) => {
    setLoadingModels(true);
    try {
      const [available, enabled] = await Promise.all([
        api.models.available(providerId),
        api.models.enabled(providerId),
      ]);
      setAvailableModels(available);
      setEnabledModels(enabled);
    } catch (err) {
      console.error(err);
      setAvailableModels([]);
      setEnabledModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  const loadUsage = useCallback(async (period: "daily" | "weekly" | "monthly") => {
    try {
      const summary = await api.usage.summary(period);
      setUsage(summary);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadLimitUsage = useCallback(async () => {
    if (!configDraft?.spending.enabled) return;
    try {
      const summary = await api.usage.summary(configDraft.spending.period);
      setLimitUsage(summary);
    } catch (err) {
      console.error(err);
    }
  }, [configDraft?.spending.enabled, configDraft?.spending.period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedProvider && isConfigured(selectedProvider)) {
      loadModels(selectedProvider);
      setSelectedModelId("");
      setShowCustom(false);
    } else {
      setAvailableModels([]);
      setEnabledModels([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, providers]);

  useEffect(() => {
    if (activeTab === "spending") {
      loadUsage(usagePeriod);
      loadLimitUsage();
    }
  }, [activeTab, usagePeriod, loadUsage, loadLimitUsage]);

  // Provider helpers
  const isConfigured = (id: string) =>
    providers.find((p) => p.id === id)?.configured ?? false;

  const connectProvider = async (providerId: string) => {
    const key = apiKeys[providerId];
    if (!key) return;
    setConnecting(providerId);
    try {
      const credKey =
        providerId === "ollama"
          ? `provider.${providerId}.host`
          : `provider.${providerId}.apiKey`;
      await api.credentials.set(credKey, key);
      setApiKeys((prev) => ({ ...prev, [providerId]: "" }));
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectProvider = async (providerId: string) => {
    try {
      const credKey =
        providerId === "ollama"
          ? `provider.${providerId}.host`
          : `provider.${providerId}.apiKey`;
      await api.credentials.delete(credKey);
      setTestResult((prev) => ({ ...prev, [providerId]: "" }));
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const testProvider = async (providerId: string) => {
    setTesting(providerId);
    setTestResult((prev) => ({ ...prev, [providerId]: "" }));
    try {
      const result = await api.providers.test(providerId);
      setTestResult((prev) => ({
        ...prev,
        [providerId]: result.success
          ? `Connected! "${result.response}"`
          : `Failed: ${result.error}`,
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [providerId]: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }));
    } finally {
      setTesting(null);
    }
  };

  // Model helpers
  const addModel = async (model: AvailableModel) => {
    if (!selectedProvider) return;
    try {
      await api.models.enable({
        provider: selectedProvider,
        modelId: model.id,
        label: model.name,
        inputPricePer1m: model.inputPricePer1m ?? 0,
        outputPricePer1m: model.outputPricePer1m ?? 0,
      });
      await loadModels(selectedProvider);
      setSelectedModelId("");
    } catch (err) {
      console.error(err);
    }
  };

  const addCustomModel = async () => {
    if (!selectedProvider || !customModel.id) return;
    try {
      await api.models.enable({
        provider: selectedProvider,
        modelId: customModel.id,
        label: customModel.name || customModel.id,
        inputPricePer1m: customModel.inputPrice,
        outputPricePer1m: customModel.outputPrice,
      });
      await loadModels(selectedProvider);
      setCustomModel({ id: "", name: "", inputPrice: 0, outputPrice: 0 });
      setShowCustom(false);
    } catch (err) {
      console.error(err);
    }
  };

  const removeModel = async (provider: string, modelId: string) => {
    try {
      await api.models.disable(provider, modelId);
      if (selectedProvider) await loadModels(selectedProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const enabledModelIds = new Set(enabledModels.map((m) => m.modelId));

  // Config helpers
  const configChanged =
    config && configDraft && JSON.stringify(config) !== JSON.stringify(configDraft);

  const saveConfig = async () => {
    if (!configDraft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        agent: {
          maxTurns: configDraft.agent.maxTurns,
          temperature: configDraft.agent.temperature,
          maxTokens: hasTokenLimit ? configDraft.agent.maxTokens : null,
        },
        spending: {
          enabled: configDraft.spending.enabled,
          maxTokens: configDraft.spending.maxTokens ?? null,
          maxCostUsd: configDraft.spending.maxCostUsd ?? null,
          period: configDraft.spending.period,
        },
        server: configDraft.server,
      };
      const updated = await api.config.update(payload as Partial<AppConfig>);
      setConfig(updated);
      setConfigDraft(updated);
      setHasTokenLimit(updated.agent.maxTokens !== undefined);
      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    if (config) {
      setConfigDraft(config);
      setHasTokenLimit(config.agent.maxTokens !== undefined);
    }
  };

  const updateDraft = (path: string, value: unknown) => {
    setConfigDraft((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      const parts = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return clone;
    });
  };

  const selectedProviderMeta = ALL_PROVIDERS.find(
    (p) => p.id === selectedProvider,
  );

  const tokenPercent = configDraft?.agent.maxTokens
    ? Math.min(100, (configDraft.agent.maxTokens / MAX_TOKEN_LIMIT) * 100)
    : 0;

  // Spending limit progress (uses limitUsage which matches the configured period)
  const spendingTokenPercent =
    configDraft?.spending.maxTokens && limitUsage
      ? Math.min(100, (limitUsage.totalTokens / configDraft.spending.maxTokens) * 100)
      : 0;
  const spendingCostPercent =
    configDraft?.spending.maxCostUsd && limitUsage
      ? Math.min(100, (limitUsage.totalCostUsd / configDraft.spending.maxCostUsd) * 100)
      : 0;

  const SaveResetButtons = () => (
    <div className="flex items-center gap-2">
      {configChanged && (
        <Button variant="ghost" size="sm" onClick={resetConfig}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
      )}
      <Button
        size="sm"
        onClick={saveConfig}
        disabled={!configChanged || saving}
      >
        <Save className="mr-1.5 h-3.5 w-3.5" />
        {saved ? "Saved!" : saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full">
      <nav className="w-48 shrink-0 border-r p-4 space-y-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* ─── Agent Settings ─── */}
          {activeTab === "agent" && configDraft && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Agent Settings</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure how the AI agent behaves during conversations.
                  </p>
                </div>
                <SaveResetButtons />
              </div>

              {/* Max Turns */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Max Turns per Run</CardTitle>
                  <CardDescription>
                    Maximum number of agent turns (tool calls + responses) in a single run.
                    Higher values allow longer autonomous workflows.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Slider
                      min={1}
                      max={200}
                      step={1}
                      value={[configDraft.agent.maxTurns]}
                      onValueChange={([v]) => updateDraft("agent.maxTurns", v)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={configDraft.agent.maxTurns}
                      onChange={(e) =>
                        updateDraft("agent.maxTurns", Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (minimal)</span>
                    <span>25 (default)</span>
                    <span>200 (max)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Temperature */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Temperature</CardTitle>
                  <CardDescription>
                    Controls randomness in responses. Lower values produce more focused
                    and deterministic output, higher values produce more creative and varied responses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={[configDraft.agent.temperature]}
                      onValueChange={([v]) =>
                        updateDraft("agent.temperature", Math.round(v * 100) / 100)
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={configDraft.agent.temperature}
                      onChange={(e) =>
                        updateDraft(
                          "agent.temperature",
                          Math.max(0, Math.min(2, Number(e.target.value) || 0)),
                        )
                      }
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.0 (precise)</span>
                    <span>0.7 (default)</span>
                    <span>2.0 (creative)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Max Tokens per Response */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm">Max Output Tokens</CardTitle>
                      <CardDescription>
                        Limit the maximum number of tokens per response.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={hasTokenLimit}
                      onCheckedChange={(checked) => {
                        setHasTokenLimit(checked);
                        if (checked && !configDraft.agent.maxTokens) {
                          updateDraft("agent.maxTokens", 8192);
                        }
                      }}
                    />
                  </div>
                </CardHeader>
                {hasTokenLimit && (
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Slider
                        min={256}
                        max={MAX_TOKEN_LIMIT}
                        step={256}
                        value={[configDraft.agent.maxTokens ?? 8192]}
                        onValueChange={([v]) => updateDraft("agent.maxTokens", v)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={256}
                        max={MAX_TOKEN_LIMIT}
                        step={256}
                        value={configDraft.agent.maxTokens ?? 8192}
                        onChange={(e) =>
                          updateDraft(
                            "agent.maxTokens",
                            Math.max(256, Math.min(MAX_TOKEN_LIMIT, Number(e.target.value) || 256)),
                          )
                        }
                        className="w-24 text-center"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {TOKEN_PRESETS.map((preset) => (
                        <Button
                          key={preset.value}
                          variant={
                            configDraft.agent.maxTokens === preset.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => updateDraft("agent.maxTokens", preset.value)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </>
          )}

          {/* ─── Spending & Usage ─── */}
          {activeTab === "spending" && configDraft && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Spending & Usage</h2>
                  <p className="text-sm text-muted-foreground">
                    Track token usage and set spending limits to control costs.
                  </p>
                </div>
                <SaveResetButtons />
              </div>

              {/* Current Usage Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Current Usage</CardTitle>
                    <div className="flex gap-1">
                      {(["daily", "weekly", "monthly"] as const).map((p) => (
                        <Button
                          key={p}
                          variant={usagePeriod === p ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs capitalize"
                          onClick={() => setUsagePeriod(p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {usage ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Tokens</p>
                        <p className="text-2xl font-bold font-mono">
                          {formatTokens(usage.totalTokens)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTokens(usage.totalInputTokens)} in / {formatTokens(usage.totalOutputTokens)} out
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Estimated Cost</p>
                        <p className="text-2xl font-bold font-mono">
                          ${usage.totalCostUsd.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          this {usagePeriod === "daily" ? "day" : usagePeriod === "weekly" ? "week" : "month"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">API Calls</p>
                        <p className="text-2xl font-bold font-mono">
                          {usage.recordCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          requests
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading usage data...</p>
                  )}
                </CardContent>
              </Card>

              {/* Spending Limits */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm">Spending Limits</CardTitle>
                      <CardDescription>
                        Set token or cost limits. The agent will be blocked when limits are reached.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={configDraft.spending.enabled}
                      onCheckedChange={(checked) => updateDraft("spending.enabled", checked)}
                    />
                  </div>
                </CardHeader>
                {configDraft.spending.enabled && (
                  <CardContent className="space-y-6">
                    {/* Limit Period */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Reset Period</Label>
                      <Select
                        value={configDraft.spending.period}
                        onValueChange={(v) => updateDraft("spending.period", v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Usage counters reset at the start of each {configDraft.spending.period === "daily" ? "day" : configDraft.spending.period === "weekly" ? "week" : "month"}.
                      </p>
                    </div>

                    {/* Token Limit */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Token Limit</Label>
                        <Switch
                          checked={configDraft.spending.maxTokens !== undefined}
                          onCheckedChange={(checked) =>
                            updateDraft("spending.maxTokens", checked ? 1_000_000 : undefined)
                          }
                        />
                      </div>
                      {configDraft.spending.maxTokens !== undefined && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {limitUsage ? formatTokens(limitUsage.totalTokens) : "0"} used
                              </span>
                              <span className="font-mono font-medium">
                                {formatTokens(configDraft.spending.maxTokens)} limit
                              </span>
                            </div>
                            <Progress
                              value={spendingTokenPercent}
                              className="h-2.5"
                              indicatorClassName={cn(
                                spendingTokenPercent > 90
                                  ? "bg-red-500"
                                  : spendingTokenPercent > 70
                                    ? "bg-orange-500"
                                    : spendingTokenPercent > 50
                                      ? "bg-yellow-500"
                                      : "bg-emerald-500",
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <Slider
                              min={100_000}
                              max={50_000_000}
                              step={100_000}
                              value={[configDraft.spending.maxTokens]}
                              onValueChange={([v]) => updateDraft("spending.maxTokens", v)}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              min={100_000}
                              step={100_000}
                              value={configDraft.spending.maxTokens}
                              onChange={(e) =>
                                updateDraft("spending.maxTokens", Math.max(100_000, Number(e.target.value) || 100_000))
                              }
                              className="w-28 text-center"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Cost Limit */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Cost Limit (USD)</Label>
                        <Switch
                          checked={configDraft.spending.maxCostUsd !== undefined}
                          onCheckedChange={(checked) =>
                            updateDraft("spending.maxCostUsd", checked ? 10 : undefined)
                          }
                        />
                      </div>
                      {configDraft.spending.maxCostUsd !== undefined && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                ${limitUsage?.totalCostUsd.toFixed(2) ?? "0.00"} spent
                              </span>
                              <span className="font-mono font-medium">
                                ${configDraft.spending.maxCostUsd.toFixed(2)} limit
                              </span>
                            </div>
                            <Progress
                              value={spendingCostPercent}
                              className="h-2.5"
                              indicatorClassName={cn(
                                spendingCostPercent > 90
                                  ? "bg-red-500"
                                  : spendingCostPercent > 70
                                    ? "bg-orange-500"
                                    : spendingCostPercent > 50
                                      ? "bg-yellow-500"
                                      : "bg-emerald-500",
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <Slider
                              min={0.5}
                              max={500}
                              step={0.5}
                              value={[configDraft.spending.maxCostUsd]}
                              onValueChange={([v]) =>
                                updateDraft("spending.maxCostUsd", Math.round(v * 100) / 100)
                              }
                              className="flex-1"
                            />
                            <div className="relative w-24">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={configDraft.spending.maxCostUsd}
                                onChange={(e) =>
                                  updateDraft(
                                    "spending.maxCostUsd",
                                    Math.max(0.5, Number(e.target.value) || 0.5),
                                  )
                                }
                                className="pl-7 text-center"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {COST_PRESETS.map((preset) => (
                              <Button
                                key={preset.value}
                                variant={
                                  configDraft.spending.maxCostUsd === preset.value
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateDraft("spending.maxCostUsd", preset.value)}
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Cost estimates are approximate and based on published model pricing.
                      Actual charges from your provider may differ. Usage is tracked per
                      API call.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ─── Providers ─── */}
          {activeTab === "providers" && (
            <>
              <div>
                <h2 className="text-lg font-semibold">AI Providers</h2>
                <p className="text-sm text-muted-foreground">
                  Connect your AI provider accounts to use different models.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {ALL_PROVIDERS.map((provMeta) => {
                  const configured = isConfigured(provMeta.id);
                  const isSelected = selectedProvider === provMeta.id;

                  return (
                    <button
                      key={provMeta.id}
                      onClick={() =>
                        setSelectedProvider(isSelected ? null : provMeta.id)
                      }
                      className={cn(
                        "relative flex flex-col items-center gap-3 rounded-lg border p-5 transition-colors",
                        isSelected
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-accent/50",
                      )}
                    >
                      {configured && (
                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <img
                        src={provMeta.logo}
                        alt={provMeta.name}
                        className={cn("h-10 w-10", provMeta.darkInvert && "dark:invert")}
                      />
                      <span className="text-xs font-medium">{provMeta.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedProviderMeta && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedProviderMeta.logo}
                          alt={selectedProviderMeta.name}
                          className={cn("h-6 w-6", selectedProviderMeta.darkInvert && "dark:invert")}
                        />
                        <span className="text-sm font-semibold">
                          {selectedProviderMeta.name}
                        </span>
                      </div>
                      <Badge
                        className={
                          isConfigured(selectedProviderMeta.id)
                            ? "bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/30"
                            : ""
                        }
                        variant={
                          isConfigured(selectedProviderMeta.id) ? "default" : "secondary"
                        }
                      >
                        {isConfigured(selectedProviderMeta.id) ? "Connected" : "Not configured"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {selectedProviderMeta.fieldLabel}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={selectedProviderMeta.fieldType}
                          placeholder={
                            isConfigured(selectedProviderMeta.id)
                              ? `Update ${selectedProviderMeta.fieldLabel.toLowerCase()}...`
                              : `Enter ${selectedProviderMeta.fieldLabel.toLowerCase()}...`
                          }
                          value={apiKeys[selectedProviderMeta.id] ?? ""}
                          onChange={(e) =>
                            setApiKeys((prev) => ({
                              ...prev,
                              [selectedProviderMeta.id]: e.target.value,
                            }))
                          }
                        />
                        {isConfigured(selectedProviderMeta.id) ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => disconnectProvider(selectedProviderMeta.id)}
                          >
                            <Unplug className="mr-1.5 h-3.5 w-3.5" />
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => connectProvider(selectedProviderMeta.id)}
                            disabled={
                              !apiKeys[selectedProviderMeta.id] ||
                              connecting === selectedProviderMeta.id
                            }
                          >
                            <Plug className="mr-1.5 h-3.5 w-3.5" />
                            {connecting === selectedProviderMeta.id ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isConfigured(selectedProviderMeta.id) && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => testProvider(selectedProviderMeta.id)}
                          disabled={testing === selectedProviderMeta.id}
                        >
                          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                          {testing === selectedProviderMeta.id ? "Testing..." : "Test connection"}
                        </Button>
                        {testResult[selectedProviderMeta.id] && (
                          <p className="text-xs text-muted-foreground">
                            {testResult[selectedProviderMeta.id]}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Model Selection ── */}
                    {isConfigured(selectedProviderMeta.id) && (
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Models</Label>
                          {loadingModels && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>

                        {/* Add model dropdown */}
                        <div className="flex gap-2">
                          <Select
                            value={showCustom ? "__custom__" : selectedModelId}
                            onValueChange={(v) => {
                              if (v === "__custom__") {
                                setShowCustom(true);
                                setSelectedModelId("");
                              } else {
                                setShowCustom(false);
                                setSelectedModelId(v);
                              }
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select a model to add..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels
                                .filter((m) => !enabledModelIds.has(m.id))
                                .map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <div className="flex items-center justify-between gap-4 w-full">
                                      <span>{m.name}</span>
                                      {(m.inputPricePer1m !== undefined || m.outputPricePer1m !== undefined) && (
                                        <span className="text-xs text-muted-foreground">
                                          ${m.inputPricePer1m?.toFixed(2) ?? "?"} / ${m.outputPricePer1m?.toFixed(2) ?? "?"} per 1M
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              <SelectItem value="__custom__">
                                <span className="text-muted-foreground">+ Custom model...</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {selectedModelId && !showCustom && (
                            <Button
                              size="sm"
                              onClick={() => {
                                const m = availableModels.find((m) => m.id === selectedModelId);
                                if (m) addModel(m);
                              }}
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add
                            </Button>
                          )}
                        </div>

                        {/* Custom model form */}
                        {showCustom && (
                          <Card className="border-dashed">
                            <CardContent className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Model ID</Label>
                                  <Input
                                    placeholder="e.g. my-model-v1"
                                    value={customModel.id}
                                    onChange={(e) => setCustomModel((p) => ({ ...p, id: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Display Name</Label>
                                  <Input
                                    placeholder="e.g. My Model v1"
                                    value={customModel.name}
                                    onChange={(e) => setCustomModel((p) => ({ ...p, name: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Input price / 1M tokens ($)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={customModel.inputPrice}
                                    onChange={(e) => setCustomModel((p) => ({ ...p, inputPrice: Number(e.target.value) || 0 }))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Output price / 1M tokens ($)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={customModel.outputPrice}
                                    onChange={(e) => setCustomModel((p) => ({ ...p, outputPrice: Number(e.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={addCustomModel} disabled={!customModel.id}>
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                  Add Custom Model
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>
                                  Cancel
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Enabled models list */}
                        {enabledModels.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Enabled Models</Label>
                            <div className="space-y-1.5">
                              {enabledModels.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center justify-between rounded-md border px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{m.label}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{m.modelId}</p>
                                  </div>
                                  <div className="flex items-center gap-3 ml-3 shrink-0">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      ${m.inputPricePer1m.toFixed(2)} / ${m.outputPricePer1m.toFixed(2)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeModel(m.provider, m.modelId)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!loadingModels && enabledModels.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No models enabled yet. Add models above to use them in chat.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ─── Updates ─── */}
          {activeTab === "updates" && (
            <>
              <div>
                <h2 className="text-lg font-semibold">Updates</h2>
                <p className="text-sm text-muted-foreground">
                  Check for and install application updates.
                </p>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Current Version</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {appVersion}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={checkForUpdates}
                      disabled={updateStatus.status === "checking" || updateStatus.status === "downloading"}
                    >
                      <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", updateStatus.status === "checking" && "animate-spin")} />
                      {updateStatus.status === "checking" ? "Checking..." : "Check for Updates"}
                    </Button>
                  </div>

                  {updateStatus.status === "up-to-date" && (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <CheckCircle2 className="h-4 w-4" />
                      You're on the latest version.
                    </div>
                  )}

                  {updateStatus.status === "available" && (
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Version {updateStatus.version} available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isDesktop ? "A new version is ready to download." : "A new version is available."}
                          </p>
                        </div>
                        {isDesktop && (
                          <Button size="sm" onClick={downloadUpdate}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </Button>
                        )}
                      </div>
                      {!isDesktop && (
                        <div className="rounded-md bg-muted p-3 space-y-1">
                          <p className="text-xs font-medium">Update via CLI:</p>
                          <code className="text-xs font-mono text-muted-foreground">npm update -g cortask</code>
                        </div>
                      )}
                    </div>
                  )}

                  {updateStatus.status === "downloading" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Downloading update...</span>
                        <span className="text-muted-foreground">
                          {Math.round(updateStatus.percent ?? 0)}%
                        </span>
                      </div>
                      <Progress value={updateStatus.percent ?? 0} />
                    </div>
                  )}

                  {updateStatus.status === "downloaded" && (
                    <div className="flex items-center justify-between rounded-md border border-green-800 bg-green-900/20 p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-green-400">
                          Version {updateStatus.version} downloaded
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Restart the app to install the update.
                        </p>
                      </div>
                      <Button size="sm" onClick={installUpdate}>
                        Restart & Install
                      </Button>
                    </div>
                  )}

                  {updateStatus.status === "error" && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {updateStatus.error ?? "An error occurred."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ─── Server Settings ─── */}
          {activeTab === "server" && configDraft && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Server Settings</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure the gateway server. Changes require a server restart.
                  </p>
                </div>
                <SaveResetButtons />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Host & Port</CardTitle>
                  <CardDescription>
                    The network interface and port the gateway listens on.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Host</Label>
                      <Input
                        value={configDraft.server.host}
                        onChange={(e) => updateDraft("server.host", e.target.value)}
                        placeholder="127.0.0.1"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use 0.0.0.0 to accept connections from all interfaces.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Port</Label>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        value={configDraft.server.port}
                        onChange={(e) =>
                          updateDraft(
                            "server.port",
                            Math.max(1, Math.min(65535, Number(e.target.value) || 3777)),
                          )
                        }
                        placeholder="3777"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: 3777
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Server className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Server settings are saved to the config file but require a restart
                      of the gateway process to take effect. The current server is running
                      on <span className="font-mono text-foreground">{config?.server.host}:{config?.server.port}</span>.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
