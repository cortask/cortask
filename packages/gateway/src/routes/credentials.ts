import { Router } from "express";
import { clearSkillCache } from "@cortask/core";
import type { GatewayContext } from "../server.js";

export function createCredentialRoutes(ctx: GatewayContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const keys = await ctx.credentialStore.list();
      res.json(keys);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || !value) {
        res.status(400).json({ error: "key and value are required" });
        return;
      }
      await ctx.credentialStore.set(key, value);
      clearSkillCache(); // Invalidate skill cache when credentials change
      res.status(201).json({ key });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:key", async (req, res) => {
    try {
      const value = await ctx.credentialStore.get(req.params.key);
      if (value === null) {
        res.status(404).json({ error: "Key not found" });
        return;
      }
      res.json({ key: req.params.key, value });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete("/:key", async (req, res) => {
    try {
      await ctx.credentialStore.delete(req.params.key);
      clearSkillCache(); // Invalidate skill cache when credentials change
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
