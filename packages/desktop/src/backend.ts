import path from "node:path";
import fs from "node:fs";
import {
  loadConfig,
  saveConfig,
  WorkspaceManager,
  SessionStore,
  migrateAllWorkspaces,
  EncryptedCredentialStore,
  AgentRunner,
  CronService,
  ArtifactStore,
  type CortaskConfig,
} from "@cortask/core";
import { resolveElectronMasterSecret } from "./safe-storage.js";

export interface BackendOptions {
  dataDir: string;
  port?: number;
  uiDistPath?: string;
}

let serverCleanup: (() => Promise<void>) | null = null;

export async function startBackend(opts: BackendOptions): Promise<number> {
  const dataDir = opts.dataDir;
  const port = opts.port ?? 3777;

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Config file
  const configPath = path.join(dataDir, "config.yaml");

  // Initialize workspace manager
  const dbPath = path.join(dataDir, "cortask.db");
  const workspaceManager = new WorkspaceManager(dbPath);

  // Run migrations
  try {
    const workspaces = await workspaceManager.list();
    migrateAllWorkspaces(workspaces);
  } catch (err) {
    console.error("[backend] Migration error:", err);
  }

  // Credential store
  const credStorePath = path.join(dataDir, "credentials.enc.json");
  const masterSecret = resolveElectronMasterSecret(dataDir);
  const credentialStore = new EncryptedCredentialStore(credStorePath, masterSecret);

  // Start the gateway server
  const { startServer } = await import("@cortask/gateway");

  // Set environment for the gateway
  process.env.CORTASK_DATA_DIR = dataDir;
  if (opts.uiDistPath) {
    process.env.CORTASK_UI_DIST = opts.uiDistPath;
  }

  // Resolve bundled skills directory for packaged app
  const { app } = await import("electron");
  if (app.isPackaged) {
    process.env.CORTASK_SKILLS_DIR = path.join(process.resourcesPath, "skills");
  }

  const { server, wss } = await startServer(port, "127.0.0.1");

  serverCleanup = () =>
    new Promise<void>((resolve) => {
      wss.close();
      server.close(() => resolve());
    });

  console.log(`\nCortask is running on port ${port}.`);

  return port;
}

export async function stopBackend(): Promise<void> {
  if (serverCleanup) {
    await serverCleanup();
    serverCleanup = null;
  }
}
