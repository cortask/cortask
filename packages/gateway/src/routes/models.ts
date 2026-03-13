import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { createProvider, getModelDefinitions, type ProviderId } from "@cortask/core";

export function createModelRoutes(ctx: GatewayContext): Router {
  const router = Router();

  // GET /api/models/:providerId/available — list available models for a provider
  router.get("/:providerId/available", async (req, res) => {
    try {
      const providerId = req.params.providerId as ProviderId;

      // Providers that fetch models from their API
      if (providerId === "openrouter" || providerId === "ollama") {
        const credKey = providerId === "ollama"
          ? "provider.ollama.host"
          : `provider.${providerId}.apiKey`;
        const credential = await ctx.credentialStore.get(credKey);
        if (!credential) {
          res.status(400).json({ error: `No credentials configured for ${providerId}` });
          return;
        }
        const provider = createProvider(providerId, credential);
        const models = await provider.listModels();
        res.json(models);
        return;
      }

      // For all other providers, return hardcoded definitions
      const models = getModelDefinitions(providerId);
      res.json(models);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/models/enabled — list all enabled models (optionally filter by provider)
  router.get("/enabled", async (_req, res) => {
    try {
      const provider = _req.query.provider as string | undefined;
      const models = ctx.modelStore.list(provider);
      res.json(models);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/models/enable — enable a model
  router.post("/enable", async (req, res) => {
    try {
      const { provider, modelId, label, inputPricePer1m, outputPricePer1m } = req.body as {
        provider: string;
        modelId: string;
        label: string;
        inputPricePer1m: number;
        outputPricePer1m: number;
      };
      if (!provider || !modelId || !label) {
        res.status(400).json({ error: "provider, modelId, and label are required" });
        return;
      }
      const model = ctx.modelStore.enable(
        provider,
        modelId,
        label,
        inputPricePer1m ?? 0,
        outputPricePer1m ?? 0,
      );
      res.json(model);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/models/disable — disable a model
  router.delete("/disable", async (req, res) => {
    try {
      const { provider, modelId } = req.body as { provider: string; modelId: string };
      if (!provider || !modelId) {
        res.status(400).json({ error: "provider and modelId are required" });
        return;
      }
      ctx.modelStore.disable(provider, modelId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
