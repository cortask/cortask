import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _require = createRequire(import.meta.url);
const PKG_VERSION: string = _require("../package.json").version;
import {
  loadConfig,
  getDataDir,
  WorkspaceManager,
  SessionStore,
  migrateAllWorkspaces,
  EncryptedCredentialStore,
  getOrCreateSecret,
  createProvider,
  AgentRunner,
  builtinTools,
  createCronTool,
  createArtifactTool,
  createBrowserTool,
  ensureBrowserInstalled,
  createSubagentTool,
  createSwitchWorkspaceTool,
  createSkillTool,
  setSubagentRunner,
  cleanupSubagentRecords,
  loadSkills,
  getEligibleSkills,
  buildSkillTools,
  CronService,
  ArtifactStore,
  UsageStore,
  ModelStore,
  TemplateStore,
  logger,
  type CortaskConfig,
  type ProviderId,
  type ToolHandler,
  type PermissionRequest,
  type QuestionnaireRequest,
  type QuestionnaireResponse,
  type ChannelType,
} from "@cortask/core";
import { TelegramAdapter, DiscordAdapter, WhatsAppAdapter, type ChannelPlugin } from "@cortask/channels";
import { createWorkspaceRoutes } from "./routes/workspaces.js";
import { createSessionRoutes } from "./routes/sessions.js";
import { createCredentialRoutes } from "./routes/credentials.js";
import { createProviderRoutes } from "./routes/providers.js";
import { createSkillRoutes } from "./routes/skills.js";
import { createCronRoutes } from "./routes/cron.js";
import { createChannelRoutes } from "./routes/channels.js";
import { createArtifactRoutes } from "./routes/artifacts.js";
import { createOnboardingRoutes } from "./routes/onboarding.js";
import { createConfigRoutes } from "./routes/config.js";
import { createUsageRoutes } from "./routes/usage.js";
import { createModelRoutes } from "./routes/models.js";
import { createTemplateRoutes } from "./routes/templates.js";
import { handleWebSocket, broadcastSessionRefresh } from "./ws.js";

export interface AgentRunnerOptions {
  onPermissionRequest?: (req: PermissionRequest) => Promise<boolean>;
  onQuestionnaireRequest?: (
    req: QuestionnaireRequest,
  ) => Promise<QuestionnaireResponse>;
}

export interface GatewayContext {
  config: CortaskConfig;
  configPath: string;
  dataDir: string;
  bundledSkillsDir: string;
  workspaceManager: WorkspaceManager;
  credentialStore: EncryptedCredentialStore;
  usageStore: UsageStore;
  modelStore: ModelStore;
  getSessionStore: (workspacePath: string) => SessionStore;
  createAgentRunner: (workspacePath: string, options?: AgentRunnerOptions) => Promise<AgentRunner>;
}

const sessionStoreCache = new Map<string, SessionStore>();

function getSessionStore(workspacePath: string): SessionStore {
  const dbPath = path.join(workspacePath, ".cortask", "sessions.db");
  let store = sessionStoreCache.get(dbPath);
  if (!store) {
    store = new SessionStore(dbPath);
    sessionStoreCache.set(dbPath, store);
  }
  return store;
}

export async function startServer(port?: number, host?: string) {
  const dataDir = getDataDir();
  const configPath = path.join(dataDir, "config.yaml");
  const config = await loadConfig(configPath);

  // Initialize logging
  logger.init(path.join(dataDir, "logs"));
  logger.info("Starting Cortask gateway", "gateway");

  // Initialize workspace manager
  const dbPath = path.join(dataDir, "cortask.db");
  const workspaceManager = new WorkspaceManager(dbPath);

  // Run database migrations for all workspaces
  try {
    const workspaces = await workspaceManager.list();
    migrateAllWorkspaces(workspaces);
  } catch (err) {
    logger.error(
      `Database migration failed: ${err instanceof Error ? err.message : String(err)}`,
      "gateway",
    );
    // Continue startup even if migration fails - SessionStore will handle missing columns
  }

  // Initialize credential store
  const secret = await getOrCreateSecret(dataDir);
  const credentialStore = new EncryptedCredentialStore(
    path.join(dataDir, "credentials.enc.json"),
    secret,
  );

  // Initialize cron service (uses central DB)
  const cronService = new CronService(dbPath);

  // Initialize model store (enabled models with pricing)
  const modelStore = new ModelStore(dbPath);

  // Initialize template store
  const templateStore = new TemplateStore(dbPath);

  // Initialize usage store (tracks token consumption, uses model store for pricing)
  const usageStore = new UsageStore(dbPath, modelStore);

  // Initialize artifact store (in-memory with TTL)
  const artifactStore = new ArtifactStore();

  // Initialize channel adapters
  const channels = new Map<string, ChannelPlugin>();
  let wss: WebSocketServer;

  // Channel message handler helper
  function wireMessageHandler(channel: ChannelPlugin) {
    const channelType = channel.id as ChannelType;

    channel.onMessage(async (msg) => {
      try {
        // Check spending limits before running
        if (config.spending.enabled) {
          const summary = usageStore.getSummary(config.spending.period);
          if (config.spending.maxTokens && summary.totalTokens >= config.spending.maxTokens) {
            return "Spending limit reached. Please increase or disable the limit.";
          }
          if (config.spending.maxCostUsd && summary.totalCostUsd >= config.spending.maxCostUsd) {
            return "Spending limit reached. Please increase or disable the limit.";
          }
        }

        const chatKey = `${channel.id}-${msg.chatId}`;
        const workspaces = await workspaceManager.list();
        if (workspaces.length === 0) return "No workspace configured.";

        // Resolve workspace: use saved mapping or fall back to first workspace
        const mappedWorkspaceId = workspaceManager.getChannelWorkspace(chatKey);
        const workspace = mappedWorkspaceId
          ? (await workspaceManager.get(mappedWorkspaceId)) ?? workspaces[0]
          : workspaces[0];

        const runner = await createAgentRunner(workspace.rootPath, undefined, {
          channelType,
          chatKey,
          chatId: msg.chatId,
        });
        const result = await runner.run({
          prompt: msg.text,
          sessionId: chatKey,
        });

        // Notify UI clients to refresh session list
        if (wss) broadcastSessionRefresh(wss, workspace.id);

        return result.response;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
  }

  // Resolve skill directories
  const bundledSkillsDir = process.env.CORTASK_SKILLS_DIR
    ?? path.join(path.resolve(__dirname, "..", "..", ".."), "skills");
  const userSkillsDir = path.join(dataDir, "skills");

  interface ChannelContext {
    channelType: ChannelType;
    chatKey: string;
    chatId: string;
  }

  // Tools that only work in the web UI (not in channels)
  const uiOnlyTools = new Set(["questionnaire", "artifact", "show_file"]);

  // Create agent runner factory
  async function createAgentRunner(workspacePath: string, options?: AgentRunnerOptions, channelCtx?: ChannelContext): Promise<AgentRunner> {
    const providerId = (config.providers.default || "anthropic") as ProviderId;
    const providerConfig = config.providers[providerId];
    const model = providerConfig?.model || getDefaultModel(providerId);

    // Get credential from credential store (Ollama uses host, others use apiKey)
    const credKey = providerId === "ollama"
      ? "provider.ollama.host"
      : `provider.${providerId}.apiKey`;
    const apiKey = await credentialStore.get(credKey);
    if (!apiKey) {
      throw new Error(
        `No credentials found for provider "${providerId}". Set it in Settings.`,
      );
    }

    const provider = createProvider(providerId, apiKey);
    const sessionStore = getSessionStore(workspacePath);

    // Load skills and build skill tools
    const allSkills = await loadSkills(
      bundledSkillsDir,
      userSkillsDir,
      config.skills.dirs,
      credentialStore,
    );
    const eligible = getEligibleSkills(allSkills);
    const skillRegistry = await buildSkillTools(eligible, credentialStore);

    // Convert skill handlers to ToolHandler format
    const skillToolHandlers: ToolHandler[] = skillRegistry.toolDefs.map((def) => ({
      definition: def,
      execute: async (args, context) => {
        const handler = skillRegistry.handlers.get(def.name);
        if (!handler) {
          return { toolCallId: "", content: `No handler for skill tool: ${def.name}`, isError: true };
        }
        return handler(args, context.workspacePath);
      },
    }));

    // Build skill prompts from eligible skills (lightweight: just name + description)
    const skillPrompts = eligible
      .map((s) => `- **${s.manifest.name}**: ${s.manifest.description}`);

    // Include switch_workspace tool only for channel-based runners
    const channelTools: ToolHandler[] = channelCtx
      ? [createSwitchWorkspaceTool(workspaceManager, channelCtx.chatKey)]
      : [];

    const runner = new AgentRunner({
      config: {
        provider,
        model,
        maxTurns: config.agent.maxTurns,
        temperature: config.agent.temperature,
        maxTokens: config.agent.maxTokens,
      },
      tools: [
        ...(channelCtx
          ? builtinTools.filter((t) => !uiOnlyTools.has(t.definition.name))
          : builtinTools),
        createCronTool(cronService),
        createSkillTool(userSkillsDir, allSkills.filter(s => s.source === "bundled").map(s => s.manifest.name)),
        ...(channelCtx ? [] : [createArtifactTool(artifactStore)]),
        createBrowserTool(artifactStore),
        createSubagentTool(),
        ...channelTools,
        ...skillToolHandlers,
      ],
      channel: channelCtx
        ? { type: channelCtx.channelType, chatId: channelCtx.chatId }
        : undefined,
      getWorkspacePath: () => workspacePath,
      getDataDir: () => dataDir,
      getMemoryContent: () => workspaceManager.readMemory(workspacePath),
      getGlobalMemoryContent: () => workspaceManager.readGlobalMemory(dataDir),
      getSkillPrompts: () => skillPrompts,
      getSessionMessages: async (sessionId) => {
        return sessionStore.getMessages(sessionId);
      },
      saveSessionMessages: async (sessionId, messages) => {
        sessionStore.saveMessages(sessionId, messages, channelCtx?.channelType);

        // Auto-set title from first user message if still default
        const session = sessionStore.getSession(sessionId);
        if (session && session.title === "New Chat") {
          const firstUserMsg = messages.find((m) => m.role === "user");
          if (firstUserMsg) {
            const text =
              typeof firstUserMsg.content === "string"
                ? firstUserMsg.content
                : firstUserMsg.content
                    .filter((p) => p.type === "text" && p.text)
                    .map((p) => p.text)
                    .join(" ");
            if (text) {
              sessionStore.updateTitle(
                sessionId,
                text.length > 80 ? text.slice(0, 80) + "…" : text,
              );
            }
          }
        }
      },
      onPermissionRequest: options?.onPermissionRequest,
      onQuestionnaireRequest: options?.onQuestionnaireRequest,
    });

    // Inject runner reference for subagent tool
    setSubagentRunner(runner);

    return runner;
  }

  const ctx: GatewayContext = {
    config,
    configPath,
    dataDir,
    bundledSkillsDir,
    workspaceManager,
    credentialStore,
    usageStore,
    modelStore,
    getSessionStore,
    createAgentRunner,
  };

  // Express app
  const app = express();

  // CORS: only allow local origins (localhost/127.0.0.1) to protect against
  // cross-origin attacks from external sites. Additional origins can be allowed
  // via CORTASK_CORS_ORIGIN env var.
  const corsOrigin = process.env.CORTASK_CORS_ORIGIN;
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (same-origin, curl, etc.)
      if (!origin) return callback(null, true);
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === finalHost) {
          return callback(null, true);
        }
      } catch { /* invalid origin */ }
      if (corsOrigin && origin === corsOrigin) return callback(null, true);
      callback(new Error("CORS not allowed"));
    },
  }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use(express.json({ limit: "10mb" }));

  // HTTP + WebSocket server (created early so wss is available to routes)
  const server = createServer(app);
  wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: ({ origin }: { origin?: string }) => {
      // Allow connections with no Origin (e.g. non-browser clients)
      if (!origin) return true;
      // Allow any local origin (localhost/127.0.0.1) regardless of port —
      // the threat is external sites, not local processes
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === finalHost) {
          return true;
        }
      } catch { /* invalid origin → reject */ }
      if (corsOrigin && origin === corsOrigin) return true;
      return false;
    },
  });
  wss.on("connection", (ws: WebSocket) => {
    handleWebSocket(ws, ctx);
  });

  // API routes
  app.use("/api/onboarding", createOnboardingRoutes(ctx));
  app.use("/api/workspaces", createWorkspaceRoutes(ctx));
  app.use("/api/sessions", createSessionRoutes(ctx));
  app.use("/api/credentials", createCredentialRoutes(ctx));
  app.use("/api/providers", createProviderRoutes(ctx));
  app.use("/api/config", createConfigRoutes(ctx));
  app.use("/api/skills", createSkillRoutes(ctx));
  app.use("/api/cron", createCronRoutes(cronService));
  app.use("/api/usage", createUsageRoutes(usageStore));
  app.use("/api/models", createModelRoutes(ctx));
  app.use("/api/templates", createTemplateRoutes(templateStore));
  async function createChannelAdapter(id: string): Promise<ChannelPlugin | null> {
    if (id === "telegram") {
      const botToken = await credentialStore.get("channel.telegram.botToken");
      if (!botToken) return null;
      const adapter = new TelegramAdapter({
        botToken,
        allowedUsers: config.channels?.telegram?.allowedUsers ?? [],
      });
      wireMessageHandler(adapter);
      return adapter;
    }
    if (id === "discord") {
      const botToken = await credentialStore.get("channel.discord.botToken");
      if (!botToken) return null;
      const adapter = new DiscordAdapter({ botToken });
      wireMessageHandler(adapter);
      return adapter;
    }
    if (id === "whatsapp") {
      const contactsJson = await credentialStore.get("channel.whatsapp.trustedContacts");
      const trustedContacts = contactsJson ? JSON.parse(contactsJson) : [];
      const adapter = new WhatsAppAdapter({ trustedContacts });
      wireMessageHandler(adapter);
      return adapter;
    }
    return null;
  }

  app.use("/api/channels", createChannelRoutes(channels, ctx, createChannelAdapter, wss));
  app.use("/api/artifacts", createArtifactRoutes(artifactStore));

  // Health check
  let gatewayReady = false;
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: PKG_VERSION, ready: gatewayReady });
  });

  // Update check
  app.get("/api/updates/check", async (_req, res) => {
    try {
      const response = await fetch("https://registry.npmjs.org/cortask/latest");
      if (!response.ok) throw new Error("Failed to fetch from npm");
      const data = await response.json() as { version: string };
      const latest = data.version;
      const hasUpdate = latest !== PKG_VERSION;
      res.json({ currentVersion: PKG_VERSION, latestVersion: latest, hasUpdate });
    } catch (err) {
      res.json({ currentVersion: PKG_VERSION, latestVersion: null, hasUpdate: false, error: (err as Error).message });
    }
  });

  // Serve built UI static files (for standalone & desktop mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resourcesPath = (process as any).resourcesPath as string | undefined;
  const uiDistCandidates = [
    path.resolve("../ui/dist"),               // monorepo dev
    path.resolve(__dirname, "../../ui/dist"),  // relative to gateway dist
    ...(resourcesPath ? [path.resolve(resourcesPath, "ui")] : []), // electron packaged
  ];
  for (const uiDir of uiDistCandidates) {
    if (fs.existsSync(path.join(uiDir, "index.html"))) {
      app.use(express.static(uiDir));
      // SPA fallback: serve index.html for non-API routes
      app.get("*", (_req, res, next) => {
        if (_req.path.startsWith("/api/") || _req.path.startsWith("/ws")) {
          return next();
        }
        res.sendFile(path.join(uiDir, "index.html"));
      });
      logger.info(`Serving UI from ${uiDir}`, "gateway");
      break;
    }
  }

  const envPort = process.env.CORTASK_PORT ? parseInt(process.env.CORTASK_PORT, 10) : undefined;
  const envHost = process.env.CORTASK_HOST;
  const finalPort = port ?? envPort ?? config.server.port;
  const finalHost = host ?? envHost ?? config.server.host;

  // Wire cron executor to agent runner
  cronService.setExecutor(async (job) => {
    // Check spending limits before running cron jobs
    if (config.spending.enabled) {
      const summary = usageStore.getSummary(config.spending.period);
      if (config.spending.maxTokens && summary.totalTokens >= config.spending.maxTokens) {
        throw new Error(`Spending limit reached: ${summary.totalTokens.toLocaleString()} / ${config.spending.maxTokens.toLocaleString()} tokens`);
      }
      if (config.spending.maxCostUsd && summary.totalCostUsd >= config.spending.maxCostUsd) {
        throw new Error(`Spending limit reached: $${summary.totalCostUsd.toFixed(2)} / $${config.spending.maxCostUsd.toFixed(2)}`);
      }
    }

    const workspaces = await workspaceManager.list();
    let workspacePath: string;

    if (job.workspaceId) {
      const ws = await workspaceManager.get(job.workspaceId);
      workspacePath = ws?.rootPath ?? workspaces[0]?.rootPath ?? dataDir;
    } else {
      workspacePath = workspaces[0]?.rootPath ?? dataDir;
    }

    const runner = await createAgentRunner(workspacePath);
    const result = await runner.run({ prompt: job.prompt });

    // Deliver to channel if specified
    if (job.delivery.channel && job.delivery.target) {
      const channel = channels.get(job.delivery.channel);
      if (!channel) {
        logger.warn(`Cron job "${job.name}" delivery failed: channel "${job.delivery.channel}" not found`, "cron");
      } else if (!channel.isRunning()) {
        logger.warn(`Cron job "${job.name}" delivery failed: channel "${job.delivery.channel}" is not running`, "cron");
      } else {
        await channel.sendMessage(job.delivery.target, result.response);
      }
    } else if (!job.delivery.channel && !job.delivery.target) {
      logger.debug(`Cron job "${job.name}" has no delivery channel configured`, "cron");
    }

    return result.response;
  });

  // Start cron service
  cronService.start();

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    server.listen(finalPort, finalHost, () => {
      logger.info(
        `Gateway running on http://${finalHost}:${finalPort}`,
        "gateway",
      );
      console.log(`Cortask gateway running on http://${finalHost}:${finalPort}`);

      // Prepare gateway: install browser, start channels, then mark ready
      (async () => {
        try {
          await ensureBrowserInstalled();
        } catch (err) {
          logger.debug(`Browser pre-install skipped: ${err instanceof Error ? err.message : err}`, "gateway");
        }
        gatewayReady = true;
        logger.info("Gateway ready", "gateway");
      })();

      // Auto-start channels that were previously enabled
      const knownChannelIds = ["telegram", "discord", "whatsapp"];
      for (const id of knownChannelIds) {
        credentialStore.get(`channel.${id}.enabled`).then(async (enabled) => {
          if (enabled !== "true") return;
          try {
            let channel = channels.get(id);
            if (!channel) {
              const created = await createChannelAdapter(id);
              if (!created) return;
              channel = created;
              channels.set(id, channel);
            }
            await channel.start();
            logger.info(`Channel "${id}" auto-started`, "gateway");
          } catch (err) {
            logger.error(`Failed to auto-start channel "${id}": ${err}`, "gateway");
          }
        });
      }

      // Cleanup completed subagent records every 10 minutes
      setInterval(() => {
        cleanupSubagentRecords(30 * 60 * 1000); // 30 min TTL
      }, 10 * 60 * 1000);

      resolve();
    });
  });

  return { server, wss, ctx };
}

export function getDefaultModel(providerId: string): string {
  switch (providerId) {
    case "anthropic":
      return "claude-sonnet-4-5-20250929";
    case "openai":
      return "gpt-4o";
    case "google":
      return "gemini-2.0-flash";
    case "moonshot":
      return "moonshot-v1-8k";
    case "grok":
      return "grok-3-latest";
    case "openrouter":
      return "openai/gpt-4o";
    case "minimax":
      return "MiniMax-Text-01";
    default:
      return "claude-sonnet-4-5-20250929";
  }
}
