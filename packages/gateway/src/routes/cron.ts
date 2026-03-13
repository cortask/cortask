import { Router } from "express";
import type { CronService } from "@cortask/core";
import type { CronJobCreate } from "@cortask/core";

export function createCronRoutes(cronService: CronService): Router {
  const router = Router();

  // List all cron jobs
  router.get("/", (_req, res) => {
    try {
      const jobs = cronService.list();
      const result = jobs.map((job) => {
        const state = cronService.getState(job.id);
        return { ...job, state };
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Get single job
  router.get("/:id", (req, res) => {
    try {
      const job = cronService.getJob(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      const state = cronService.getState(job.id);
      res.json({ ...job, state });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Create a cron job
  router.post("/", (req, res) => {
    try {
      const input: CronJobCreate = req.body;
      if (!input.name || !input.schedule || !input.prompt) {
        res
          .status(400)
          .json({ error: "name, schedule, and prompt are required" });
        return;
      }
      const job = cronService.add(input);
      res.status(201).json(job);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Update a cron job
  router.put("/:id", (req, res) => {
    try {
      const updated = cronService.update(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Delete a cron job
  router.delete("/:id", (req, res) => {
    try {
      const removed = cronService.remove(req.params.id);
      if (!removed) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Run a job immediately
  router.post("/:id/run", async (req, res) => {
    try {
      await cronService.runNow(req.params.id);
      res.json({ status: "executed" });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
