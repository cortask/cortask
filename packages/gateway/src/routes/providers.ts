import { Router } from "express";
import type { GatewayContext } from "../server.js";
import { createProvider, saveConfig, type ProviderId } from "@cortask/core";

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", defaultModel: "claude-sonnet-4-5-20250929", credKey: "provider.anthropic.apiKey" },
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o", credKey: "provider.openai.apiKey" },
  { id: "google", name: "Google", defaultModel: "gemini-2.0-flash", credKey: "provider.google.apiKey" },
  { id: "moonshot", name: "Moonshot", defaultModel: "moonshot-v1-8k", credKey: "provider.moonshot.apiKey" },
  { id: "grok", name: "Grok", defaultModel: "grok-3-latest", credKey: "provider.grok.apiKey" },
  { id: "openrouter", name: "OpenRouter", defaultModel: "openai/gpt-4o", credKey: "provider.openrouter.apiKey" },
  { id: "minimax", name: "MiniMax", defaultModel: "MiniMax-Text-01", credKey: "provider.minimax.apiKey" },
  { id: "ollama", name: "Ollama", defaultModel: "llama3", credKey: "provider.ollama.host" },
] as const;

export function createProviderRoutes(ctx: GatewayContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const providers = await Promise.all(
        PROVIDERS.map(async (p) => {
          const providerConfig = ctx.config.providers[p.id as ProviderId];
          const configModel = providerConfig?.model;
          return {
            id: p.id,
            name: p.name,
            defaultModel: configModel || p.defaultModel,
            configured: await ctx.credentialStore.has(p.credKey),
            isDefault: ctx.config.providers.default === p.id,
          };
        }),
      );
      res.json(providers);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put("/default", async (req, res) => {
    try {
      const { providerId, model } = req.body as { providerId: string; model: string };
      if (!providerId || !model) {
        res.status(400).json({ error: "providerId and model are required" });
        return;
      }

      // Update in-memory config
      ctx.config.providers.default = providerId;
      const key = providerId as ProviderId;
      if (key in ctx.config.providers) {
        ctx.config.providers[key] = { model };
      }

      // Persist to config file
      await saveConfig(ctx.configPath, ctx.config);

      res.json({ providerId, model });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/:id/test", async (req, res) => {
    try {
      const providerId = req.params.id as ProviderId;
      const provMeta = PROVIDERS.find((p) => p.id === providerId);
      const apiKey = await ctx.credentialStore.get(
        provMeta?.credKey ?? `provider.${providerId}.apiKey`,
      );
      if (!apiKey) {
        res.status(400).json({ error: "No API key configured" });
        return;
      }

      const provider = createProvider(providerId, apiKey);
      const result = await provider.generateText({
        model:
          PROVIDERS.find((p) => p.id === providerId)?.defaultModel ??
          "claude-sonnet-4-5-20250929",
        messages: [{ role: "user", content: "Say hi in 3 words" }],
        maxTokens: 20,
      });

      res.json({
        success: true,
        response: result.content,
        usage: result.usage,
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
