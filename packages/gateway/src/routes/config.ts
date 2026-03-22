import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { saveConfig } from "@cortask/core";

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
          embeddingProvider?: "local" | "api";
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
        if (memory.embeddingProvider !== undefined) {
          (ctx.config as any).memory.embeddingProvider = memory.embeddingProvider;
        }
        if (memory.embeddingModel !== undefined) {
          (ctx.config as any).memory.embeddingModel = memory.embeddingModel;
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

  return router;
}
