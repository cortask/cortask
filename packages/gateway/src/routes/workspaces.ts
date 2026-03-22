import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
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

  // List recent files in workspace
  router.get("/:id/list-files", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.get(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      let entries: Array<{ name: string; mtime: number }> = [];
      try {
        const dirents = await fs.readdir(workspace.rootPath, { withFileTypes: true });
        const fileEntries = dirents.filter(
          (d) => d.isFile() && d.name !== ".cortask",
        );
        const withStats = await Promise.all(
          fileEntries.map(async (d) => {
            const stat = await fs.stat(path.join(workspace.rootPath, d.name));
            return { name: d.name, mtime: stat.mtimeMs };
          }),
        );
        entries = withStats.sort((a, b) => b.mtime - a.mtime).slice(0, 10);
      } catch {
        // Directory may not exist yet
      }
      res.json({ files: entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Read workspace memory
  router.get("/:id/memory", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.get(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      const content = await ctx.workspaceManager.readMemory(workspace.rootPath);
      res.json({ content: content ?? null });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Write workspace memory
  router.put("/:id/memory", async (req, res) => {
    try {
      const workspace = await ctx.workspaceManager.get(req.params.id);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      const { content } = req.body;
      if (typeof content !== "string") {
        res.status(400).json({ error: "content string required" });
        return;
      }
      await ctx.workspaceManager.writeMemory(workspace.rootPath, content);
      res.json({ ok: true });
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
