import { Router } from "express";
import type { ArtifactStore } from "@cortask/core";

export function createArtifactRoutes(artifactStore: ArtifactStore): Router {
  const router = Router();

  // Get artifact by ID
  router.get("/:id", (req, res) => {
    const artifact = artifactStore.get(req.params.id);
    if (!artifact) {
      res.status(404).json({ error: "Artifact not found or expired" });
      return;
    }

    // If ?raw query param, serve the content directly with correct mime type
    if (req.query.raw !== undefined) {
      res.setHeader("Content-Type", artifact.mimeType);
      // Image artifacts are stored as base64 — decode to binary
      if (artifact.type === "image") {
        res.send(Buffer.from(artifact.content, "base64"));
      } else {
        res.send(artifact.content);
      }
      return;
    }

    res.json({
      id: artifact.id,
      type: artifact.type,
      title: artifact.title,
      content: artifact.content,
      mimeType: artifact.mimeType,
      createdAt: artifact.createdAt,
    });
  });

  // List all artifacts
  router.get("/", (_req, res) => {
    const artifacts = artifactStore.list();
    res.json(
      artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
      })),
    );
  });

  return router;
}
