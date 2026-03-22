import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { createProvider, type ProviderId } from "@cortask/core";
import { getDefaultModel } from "../server.js";

export function createLlmRoutes(ctx: GatewayContext): Router {
  const router = Router();

  // Simple one-shot completion (used for cron expression conversion, etc.)
  router.post("/complete", async (req, res) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt) {
        res.status(400).json({ error: "prompt is required" });
        return;
      }

      const providerId = (ctx.config.providers.default || "anthropic") as ProviderId;
      const credKey = providerId === "ollama"
        ? "provider.ollama.host"
        : `provider.${providerId}.apiKey`;
      const apiKey = await ctx.credentialStore.get(credKey);
      if (!apiKey) {
        res.status(400).json({ error: "No API key configured" });
        return;
      }

      const provider = createProvider(providerId, apiKey);
      const model = ctx.config.providers[providerId]?.model || getDefaultModel(providerId);

      const result = await provider.generateText({
        model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 200,
      });

      res.json({ response: result.content });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
