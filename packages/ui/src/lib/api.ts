const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Workspaces
export const api = {
  workspaces: {
    list: () => request<Workspace[]>("/workspaces"),
    get: (id: string) => request<Workspace>(`/workspaces/${id}`),
    create: (name: string, rootPath?: string) =>
      request<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, ...(rootPath ? { rootPath } : {}) }),
      }),
    update: (id: string, data: Partial<Workspace>) =>
      request<Workspace>(`/workspaces/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/workspaces/${id}`, { method: "DELETE" }),
    open: (id: string) =>
      request<Workspace>(`/workspaces/${id}/open`, { method: "POST" }),
    reorder: (ids: string[]) =>
      request<{ ok: boolean }>("/workspaces/reorder", {
        method: "PUT",
        body: JSON.stringify({ ids }),
      }),
    getTree: (id: string, depth?: number) =>
      request<{ tree: Array<{ path: string; name: string; type: "file" | "dir" }> }>(
        `/workspaces/${id}/tree${depth ? `?depth=${depth}` : ""}`
      ),
    listFiles: (id: string) =>
      request<{ files: Array<{ name: string; mtime: number }> }>(`/workspaces/${id}/list-files`),
    readMemory: (id: string) =>
      request<{ content: string | null }>(`/workspaces/${id}/memory`),
    writeMemory: (id: string, content: string) =>
      request<{ ok: boolean }>(`/workspaces/${id}/memory`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },

  sessions: {
    list: (workspaceId: string) =>
      request<Session[]>(`/sessions?workspaceId=${workspaceId}`),
    get: (id: string, workspaceId: string) =>
      request<SessionWithMessages>(
        `/sessions/${id}?workspaceId=${workspaceId}`,
      ),
    delete: (id: string, workspaceId: string) =>
      request<void>(`/sessions/${id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
      }),
  },

  credentials: {
    list: () => request<string[]>("/credentials"),
    get: (key: string) =>
      request<{ key: string; value: string }>(`/credentials/${encodeURIComponent(key)}`),
    set: (key: string, value: string) =>
      request<{ key: string }>("/credentials", {
        method: "POST",
        body: JSON.stringify({ key, value }),
      }),
    delete: (key: string) =>
      request<void>(`/credentials/${encodeURIComponent(key)}`, { method: "DELETE" }),
  },

  providers: {
    list: () => request<Provider[]>("/providers"),
    test: (id: string) =>
      request<{ success: boolean; response?: string; error?: string }>(
        `/providers/${id}/test`,
        { method: "POST" },
      ),
    setDefault: (providerId: string, model: string) =>
      request<{ providerId: string; model: string }>("/providers/default", {
        method: "PUT",
        body: JSON.stringify({ providerId, model }),
      }),
  },

  skills: {
    list: () => request<SkillInfo[]>("/skills"),
    install: (gitUrl: string) =>
      request<{ name: string; path: string }>("/skills/install", {
        method: "POST",
        body: JSON.stringify({ gitUrl }),
      }),
    remove: (name: string) =>
      request<void>(`/skills/${name}`, { method: "DELETE" }),
    create: (data: { name: string; content: string }) =>
      request<{ name: string; path: string }>("/skills", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (name: string, data: { content: string }) =>
      request<{ name: string }>(`/skills/${encodeURIComponent(name)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getContent: (name: string) =>
      request<{ name: string; content: string }>(
        `/skills/${encodeURIComponent(name)}/content`,
      ),
    oauth2Authorize: (name: string) =>
      request<{ authorizationUrl: string; redirectUri: string }>(`/skills/${encodeURIComponent(name)}/oauth2/authorize`),
    oauth2RedirectUri: (name: string) =>
      request<{ redirectUri: string }>(`/skills/${encodeURIComponent(name)}/oauth2/redirect-uri`),
    oauth2Status: (name: string) =>
      request<{ connected: boolean; expired: boolean; expiresAt: number | null; hasRefreshToken: boolean }>(
        `/skills/${encodeURIComponent(name)}/oauth2/status`,
      ),
    oauth2Revoke: (name: string) =>
      request<{ ok: boolean }>(`/skills/${encodeURIComponent(name)}/oauth2/revoke`, {
        method: "POST",
      }),
  },

  cron: {
    list: (workspaceId?: string) =>
      request<CronJobWithState[]>(workspaceId ? `/cron?workspaceId=${workspaceId}` : "/cron"),
    get: (id: string) => request<CronJobWithState>(`/cron/${id}`),
    create: (input: CronJobInput) =>
      request<CronJobInfo>("/cron", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, data: Partial<CronJobInput>) =>
      request<CronJobInfo>(`/cron/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/cron/${id}`, { method: "DELETE" }),
    runNow: (id: string) =>
      request<{ status: string }>(`/cron/${id}/run`, { method: "POST" }),
  },

  channels: {
    list: () => request<ChannelStatus[]>("/channels"),
    start: (id: string) =>
      request<ChannelStatus>(`/channels/${id}/start`, { method: "POST" }),
    stop: (id: string) =>
      request<ChannelStatus>(`/channels/${id}/stop`, { method: "POST" }),
    whatsappQR: () =>
      request<{ qrDataUrl?: string; success: boolean; message: string }>(
        "/channels/whatsapp/qr",
        { method: "POST" },
      ),
    whatsappLogout: () =>
      request<{ success: boolean }>("/channels/whatsapp/logout", { method: "POST" }),
    whatsappContacts: () =>
      request<TrustedContact[]>("/channels/whatsapp/contacts"),
    whatsappSetContacts: (contacts: TrustedContact[]) =>
      request<TrustedContact[]>("/channels/whatsapp/contacts", {
        method: "PUT",
        body: JSON.stringify(contacts),
      }),
  },

  config: {
    get: () => request<AppConfig>("/config"),
    update: (data: Partial<AppConfig>) =>
      request<AppConfig>("/config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  usage: {
    summary: (period: "daily" | "weekly" | "monthly" = "monthly") =>
      request<UsageSummary>(`/usage?period=${period}`),
    history: (days: number = 30) =>
      request<UsageHistoryEntry[]>(`/usage/history?days=${days}`),
  },

  models: {
    available: (providerId: string) =>
      request<AvailableModel[]>(`/models/${providerId}/available`),
    enabled: (provider?: string) =>
      request<EnabledModel[]>(`/models/enabled${provider ? `?provider=${provider}` : ""}`),
    enable: (data: { provider: string; modelId: string; label: string; inputPricePer1m: number; outputPricePer1m: number }) =>
      request<EnabledModel>("/models/enable", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    disable: (provider: string, modelId: string) =>
      request<{ success: boolean }>("/models/disable", {
        method: "DELETE",
        body: JSON.stringify({ provider, modelId }),
      }),
  },

  templates: {
    list: () => request<PromptTemplate[]>("/templates"),
    create: (name: string, content: string, category?: string) =>
      request<PromptTemplate>("/templates", {
        method: "POST",
        body: JSON.stringify({ name, content, category }),
      }),
    update: (id: string, data: Partial<Pick<PromptTemplate, "name" | "content" | "category">>) =>
      request<PromptTemplate>(`/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/templates/${id}`, { method: "DELETE" }),
  },

  onboarding: {
    status: () => request<OnboardingStatus>("/onboarding/status"),
    complete: (data: OnboardingData) =>
      request<{ success: boolean }>("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  updates: {
    check: () => request<UpdateInfo>("/updates/check"),
  },
};

// Types
export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  lastAccessedAt: string;
  provider?: string;
  model?: string;
  skills?: string[];
}

export type ChannelType = "whatsapp" | "telegram" | "discord";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  channel?: ChannelType;
}

export interface SessionWithMessages extends Session {
  messages: Array<{
    role: string;
    content: string | ContentPart[];
  }>;
}

export interface ContentPart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  isError?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  defaultModel: string;
  configured: boolean;
  isDefault: boolean;
}

export interface SkillCredentialField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
}

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  pkce?: boolean;
  refreshable?: boolean;
}

export interface SkillCredentialDef {
  id: string;
  type: string;
  name: string;
  description?: string;
  fields?: SkillCredentialField[];
  oauth?: OAuth2Config;
  storeAs?: string;
  multiple?: boolean;
}

export interface CronSchedule {
  type: "at" | "every" | "cron";
  datetime?: string;
  intervalMs?: number;
  expression?: string;
  timezone?: string;
}

export interface CronJobInfo {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  prompt: string;
  delivery: { channel?: string; target?: string; sessionKey?: string };
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

export interface CronJobWithState extends CronJobInfo {
  state: CronJobState | null;
}

export interface CronJobInput {
  name: string;
  schedule: CronSchedule;
  prompt: string;
  delivery?: { channel?: string; target?: string };
  workspaceId?: string;
  enabled?: boolean;
}

export interface ChannelStatus {
  id: string;
  name: string;
  running: boolean;
  authenticated?: boolean;
}

export interface TrustedContact {
  phone: string;
  name?: string;
  permission: "read" | "write" | "admin";
}

export interface SkillInfo {
  name: string;
  description: string;
  eligible: boolean;
  ineligibleReason?: string;
  source: "bundled" | "user" | "git" | "config-dir";
  editable: boolean;
  hasCodeTools: boolean;
  toolCount: number;
  tags: string[];
  homepage: string | null;
  content: string;
  installOptions?: Array<{ id: string; kind: string; label: string }>;
  credentialSchema?: { credentials: SkillCredentialDef[] };
  credentialStatus?: Record<string, boolean>;
}

export interface AppConfig {
  agent: {
    maxTurns: number;
    temperature: number;
    maxTokens?: number;
  };
  spending: {
    enabled: boolean;
    maxTokens?: number;
    maxCostUsd?: number;
    period: "daily" | "weekly" | "monthly";
  };
  server: {
    port: number;
    host: string;
  };
  dataDir: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  recordCount: number;
}

export interface UsageHistoryEntry {
  date: string;
  tokens: number;
  costUsd: number;
}

export interface OnboardingStatus {
  completed: boolean;
  hasProvider: boolean;
  hasWorkspace: boolean;
}

export interface OnboardingData {
  provider: {
    type: string;
    apiKey?: string;
    host?: string;
  };
}

export interface AvailableModel {
  id: string;
  name: string;
  contextWindow?: number;
  inputPricePer1m?: number;
  outputPricePer1m?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  error?: string;
}

export interface EnabledModel {
  id: string;
  provider: string;
  modelId: string;
  label: string;
  inputPricePer1m: number;
  outputPricePer1m: number;
  enabledAt: string;
}
