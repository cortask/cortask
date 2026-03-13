import { Router } from "express";
import path from "node:path";
import type { GatewayContext } from "../server.js";

export function createWorkspaceRoutes(ctx: GatewayContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const workspaces = await ctx.workspaceManager.list();
      res.json(workspaces);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.get(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      res.json(workspace);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { name, rootPath } = req.body;
      if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const workspace = await ctx.workspaceManager.create(name, rootPath || undefined);
      res.status(201).json(workspace);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put("/reorder", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        res.status(400).json({ error: "ids array required" });
        return;
      }
      await ctx.workspaceManager.reorder(ids);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      await ctx.workspaceManager.update(req.params.id, req.body);
      const updated = await ctx.workspaceManager.get(req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await ctx.workspaceManager.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/:id/open", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.open(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      res.json(workspace);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Serve workspace files for download
  router.get("/:id/files/*", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.get(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      const relPath = (req.params as unknown as Record<string, string>)["0"];
      if (!relPath) {
        res.status(400).json({ error: "File path required" });
        return;
      }

      const fullPath = path.resolve(workspace.rootPath, relPath);

      // Prevent directory traversal
      if (!fullPath.startsWith(path.resolve(workspace.rootPath))) {
        res.status(403).json({ error: "Path outside workspace" });
        return;
      }

      res.sendFile(fullPath, (err) => {
        if (err) {
          res.status(404).json({ error: "File not found" });
        }
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
