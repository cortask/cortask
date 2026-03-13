import { Router } from "express";
import type { GatewayContext } from "../server.js";

export function createSessionRoutes(ctx: GatewayContext): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId query param required" });
        return;
      }
      const workspace = await ctx.workspaceManager.get(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      const store = ctx.getSessionStore(workspace.rootPath);
      const sessions = store.listSessions();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId query param required" });
        return;
      }
      const workspace = await ctx.workspaceManager.get(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      const store = ctx.getSessionStore(workspace.rootPath);
      const session = store.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId query param required" });
        return;
      }
      const workspace = await ctx.workspaceManager.get(workspaceId);
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      const store = ctx.getSessionStore(workspace.rootPath);
      store.deleteSession(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
