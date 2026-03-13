import { Router } from "express";
import type { TemplateStore } from "@cortask/core";

export function createTemplateRoutes(templateStore: TemplateStore): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      const templates = templateStore.list();
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/", (req, res) => {
    try {
      const { name, content, category } = req.body;
      if (!name || !content) {
        res.status(400).json({ error: "name and content are required" });
        return;
      }
      const template = templateStore.create(name, content, category);
      res.status(201).json(template);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put("/:id", (req, res) => {
    try {
      const updated = templateStore.update(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      templateStore.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
