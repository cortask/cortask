import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { saveConfig, AVAILABLE_PROVIDERS } from "@cortask/core";

export function createOnboardingRoutes(ctx: GatewayContext): Router {
  const router = Router();

  // GET /api/onboarding/status
  router.get("/status", async (_req, res) => {
    try {
      const hasProvider = await Promise.any(
        AVAILABLE_PROVIDERS.flatMap((p) => [
          ctx.credentialStore.has(`provider.${p.id}.apiKey`),
          ctx.credentialStore.has(`provider.${p.id}.host`),
        ])
      ).catch(() => false);

      const workspaces = await ctx.workspaceManager.list();
      const hasWorkspace = workspaces.length > 0;

      res.json({
        completed: ctx.config.onboarded === true,
        hasProvider,
        hasWorkspace,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // POST /api/onboarding/complete
  router.post("/complete", async (req, res) => {
    try {
      const { provider } = req.body;

      const isOllama = provider?.type === "ollama";
      if (!provider?.type || (!provider?.apiKey && !provider?.host)) {
        res.status(400).json({ error: "Provider configuration required" });
        return;
      }

      // Save credential to store
      const credKey = isOllama
        ? `provider.${provider.type}.host`
        : `provider.${provider.type}.apiKey`;
      const credValue = isOllama ? provider.host : provider.apiKey;
      await ctx.credentialStore.set(credKey, credValue);

      // Update config
      const newConfig = {
        ...ctx.config,
        onboarded: true,
        providers: {
          ...ctx.config.providers,
          default: provider.type,
        },
      };

      await saveConfig(ctx.configPath, newConfig);

      // Reload config in context
      Object.assign(ctx.config, newConfig);

      // Auto-create a default project if none exist
      const workspaces = await ctx.workspaceManager.list();
      if (workspaces.length === 0) {
        await ctx.workspaceManager.create("Default");
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
