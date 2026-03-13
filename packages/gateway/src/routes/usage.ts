import { Router } from "express";
import type { UsageStore } from "@cortask/core";

export function createUsageRoutes(usageStore: UsageStore): Router {
  const router = Router();

  // GET /api/usage?period=daily|weekly|monthly
  router.get("/", (req, res) => {
    try {
      const period = (req.query.period as string) || "monthly";
      if (!["daily", "weekly", "monthly"].includes(period)) {
        res.status(400).json({ error: "Invalid period. Use daily, weekly, or monthly." });
        return;
      }
      const summary = usageStore.getSummary(period as "daily" | "weekly" | "monthly");
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/usage/history?days=30
  router.get("/history", (req, res) => {
    try {
      const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));
      const history = usageStore.getHistory(days);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
