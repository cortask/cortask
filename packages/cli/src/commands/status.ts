import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getDataDir, loadConfig, WorkspaceManager } from "@cortask/core";
import { theme } from "../terminal/theme.js";

async function fetchHealth(host: string, port: number) {
  try {
    const res = await fetch(`http://${host}:${port}/api/health`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const statusCommand = new Command("status")
  .description("Show system status and configuration")
  .action(async () => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");

    if (!fs.existsSync(configPath)) {
      console.error(theme.error("\n✗ No configuration found"));
      console.error(theme.muted("  Run this command to set up:"));
      console.error(theme.command("  cortask setup"));
      console.log();
      process.exit(1);
    }

    try {
      const config = await loadConfig(configPath);
      const host = config.server.host;
      const port = config.server.port;

      console.log(theme.heading("\n Configuration"));
      console.log(`  File: ${theme.info(configPath)}`);
      console.log(`  Data: ${theme.info(dataDir)}`);

      // Gateway status
      console.log(theme.heading("\n Gateway"));
      const health = await fetchHealth(host, port);
      if (health) {
        console.log(`  Status: ${theme.success("online")}`);
        console.log(`  URL: ${theme.info(`http://${host}:${port}`)}`);
      } else {
        console.log(`  Status: ${theme.error("offline")}`);
        console.log(`  Expected: ${theme.muted(`http://${host}:${port}`)}`);
      }

      // Provider
      console.log(theme.heading("\n Provider"));
      console.log(`  Default: ${theme.command(config.providers.default)}`);

      // Workspaces
      console.log(theme.heading("\n Workspaces"));
      const dbPath = path.join(dataDir, "cortask.db");
      if (fs.existsSync(dbPath)) {
        const wm = new WorkspaceManager(dbPath);
        const workspaces = await wm.list();
        if (workspaces.length === 0) {
          console.log(`  ${theme.muted("No workspaces registered")}`);
        } else {
          for (const w of workspaces) {
            console.log(`  ${theme.success("✓")} ${theme.command(w.name)} ${theme.muted(`→ ${w.rootPath}`)}`);
          }
        }
        wm.close();
      } else {
        console.log(`  ${theme.muted("Database not initialized")}`);
      }

      // Skills
      console.log(theme.heading("\n Skills"));
      const skillsDir = path.join(dataDir, "skills");
      if (fs.existsSync(skillsDir)) {
        const entries = fs.readdirSync(skillsDir).filter((e) =>
          fs.statSync(path.join(skillsDir, e)).isDirectory(),
        );
        console.log(`  Installed: ${theme.info(entries.length.toString())} skill(s)`);
      } else {
        console.log(`  ${theme.muted("No skills directory")}`);
      }

      console.log();
    } catch (err) {
      console.error(theme.error("\n✗ Failed to load status"));
      console.error(theme.muted(`  ${(err as Error).message}`));
      process.exit(1);
    }
  });
