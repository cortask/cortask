import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { saveConfig, createProvider, type ProviderId } from "@cortask/core";

export function createConfigRoutes(ctx: GatewayContext): Router {
  const router = Router();

  // GET /api/config — return current config (excluding sensitive fields)
  router.get("/", (_req, res) => {
    try {
      const { agent, server, spending, memory } = ctx.config;
      res.json({ agent, server, spending, memory, dataDir: ctx.dataDir });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/config — update config fields
  router.put("/", async (req, res) => {
    try {
      const { agent, server, spending, memory } = req.body as {
        agent?: { maxTurns?: number; temperature?: number; maxTokens?: number | null };
        server?: { port?: number; host?: string };
        spending?: {
          enabled?: boolean;
          maxTokens?: number | null;
          maxCostUsd?: number | null;
          period?: "daily" | "weekly" | "monthly";
        };
        memory?: {
          embeddingProvider?: "local" | "openai" | "google" | "ollama";
          embeddingModel?: string;
        };
      };

      if (agent) {
        if (agent.maxTurns !== undefined) {
          const v = Math.max(1, Math.min(200, Math.round(agent.maxTurns)));
          ctx.config.agent.maxTurns = v;
        }
        if (agent.temperature !== undefined) {
          const v = Math.max(0, Math.min(2, agent.temperature));
          ctx.config.agent.temperature = Math.round(v * 100) / 100;
        }
        if (agent.maxTokens !== undefined) {
          ctx.config.agent.maxTokens = agent.maxTokens === null ? undefined : Math.max(1, Math.round(agent.maxTokens));
        }
      }

      if (server) {
        if (server.port !== undefined) {
          ctx.config.server.port = Math.max(1, Math.min(65535, Math.round(server.port)));
        }
        if (server.host !== undefined) {
          ctx.config.server.host = server.host;
        }
      }

      if (spending) {
        if (spending.enabled !== undefined) {
          ctx.config.spending.enabled = spending.enabled;
        }
        if (spending.maxTokens !== undefined) {
          ctx.config.spending.maxTokens = spending.maxTokens === null ? undefined : Math.max(0, Math.round(spending.maxTokens));
        }
        if (spending.maxCostUsd !== undefined) {
          ctx.config.spending.maxCostUsd = spending.maxCostUsd === null ? undefined : Math.max(0, spending.maxCostUsd);
        }
        if (spending.period !== undefined) {
          ctx.config.spending.period = spending.period;
        }
      }

      if (memory) {
        const providerChanged = memory.embeddingProvider !== undefined
          && memory.embeddingProvider !== (ctx.config as any).memory?.embeddingProvider;
        const modelChanged = memory.embeddingModel !== undefined
          && memory.embeddingModel !== (ctx.config as any).memory?.embeddingModel;

        if (memory.embeddingProvider !== undefined) {
          (ctx.config as any).memory.embeddingProvider = memory.embeddingProvider;
        }
        if (memory.embeddingModel !== undefined) {
          (ctx.config as any).memory.embeddingModel = memory.embeddingModel;
        }

        if (providerChanged || modelChanged) {
          ctx.invalidateMemoryManagers();
        }
      }

      await saveConfig(ctx.configPath, ctx.config);

      res.json({
        agent: ctx.config.agent,
        server: ctx.config.server,
        spending: ctx.config.spending,
        memory: (ctx.config as any).memory,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/config/memory/test-embedding — test embedding provider connection
  router.post("/memory/test-embedding", async (req, res) => {
    try {
      const { provider, apiKey, model } = req.body as {
        provider: string;
        apiKey?: string;
        model?: string;
      };

      if (provider === "local") {
        // Local embedding doesn't need a connection test — just confirm it's selected
        res.json({ success: true, message: "Local embeddings use on-device model. No API connection needed.", dimensions: null });
        return;
      }

      const providerMap: Record<string, { id: ProviderId; credKey: string; defaultModel: string }> = {
        openai: { id: "openai" as ProviderId, credKey: "provider.openai.apiKey", defaultModel: "text-embedding-3-small" },
        google: { id: "google" as ProviderId, credKey: "provider.google.apiKey", defaultModel: "text-embedding-004" },
        ollama: { id: "ollama" as ProviderId, credKey: "provider.ollama.host", defaultModel: "nomic-embed-text" },
      };

      const providerInfo = providerMap[provider];
      if (!providerInfo) {
        res.status(400).json({ success: false, error: `Unknown embedding provider: ${provider}` });
        return;
      }

      // Use provided API key or fall back to stored credential
      const key = apiKey || await ctx.credentialStore.get(providerInfo.credKey);
      if (!key) {
        res.status(400).json({ success: false, error: "No API key configured. Add one in the AI Providers tab or enter it above." });
        return;
      }

      const llmProvider = createProvider(providerInfo.id, key);
      const embeddingModel = model || providerInfo.defaultModel;
      const result = await llmProvider.embed({
        model: embeddingModel,
        inputs: ["test"],
      });

      res.json({
        success: true,
        message: `Connected successfully. Model: ${embeddingModel}`,
        dimensions: result.embeddings[0]?.length ?? null,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
