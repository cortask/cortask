import crypto from "node:crypto";

export interface Artifact {
  id: string;
  type: "html" | "csv" | "image" | "json" | "text" | "svg";
  title: string;
  content: string;
  mimeType: string;
  createdAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ArtifactStore {
  private store = new Map<string, Artifact>();

  create(
    type: Artifact["type"],
    title: string,
    content: string,
  ): Artifact {
    this.pruneExpired();

    const id = crypto.randomUUID();
    const mimeType = getMimeType(type);
    const artifact: Artifact = {
      id,
      type,
      title,
      content,
      mimeType,
      createdAt: Date.now(),
    };
    this.store.set(id, artifact);
    return artifact;
  }

  get(id: string): Artifact | undefined {
    const artifact = this.store.get(id);
    if (artifact && Date.now() - artifact.createdAt > TTL_MS) {
      this.store.delete(id);
      return undefined;
    }
    return artifact;
  }

  list(): Artifact[] {
    this.pruneExpired();
    return Array.from(this.store.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, artifact] of this.store) {
      if (now - artifact.createdAt > TTL_MS) {
        this.store.delete(id);
      }
    }
  }
}

function getMimeType(type: Artifact["type"]): string {
  switch (type) {
    case "html":
      return "text/html";
    case "csv":
      return "text/csv";
    case "image":
      return "image/png";
    case "json":
      return "application/json";
    case "svg":
      return "image/svg+xml";
    case "text":
    default:
      return "text/plain";
  }
}
