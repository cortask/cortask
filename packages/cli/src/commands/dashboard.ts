import { Command } from "commander";
import { exec } from "node:child_process";
import path from "node:path";
import { getDataDir, loadConfig } from "@cortask/core";
import { theme } from "../terminal/theme.js";

function openBrowser(url: string): Promise<void> {
  const cmd =
    process.platform === "win32"
      ? `start ${url}`
      : process.platform === "darwin"
        ? `open ${url}`
        : `xdg-open ${url}`;

  return new Promise((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

async function isGatewayOnline(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export const dashboardCommand = new Command("dashboard")
  .description("Open the web UI in your browser")
  .option("--no-open", "Print URL without opening browser")
  .action(async (opts: { open: boolean }) => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");
    const config = await loadConfig(configPath);
    const url = `http://${config.server.host}:${config.server.port}`;

    const online = await isGatewayOnline(config.server.host, config.server.port);
    if (!online) {
      console.log(theme.warn("\n⚠ Gateway appears to be offline"));
      console.log(theme.muted("  Start it with:"));
      console.log(theme.command("  cortask serve"));
      console.log();
    }

    if (opts.open) {
      console.log(theme.info(`\nOpening dashboard: ${url}`));
      try {
        await openBrowser(url);
        console.log(theme.success("✓ Browser opened"));
      } catch {
        console.log(theme.warn("\n⚠ Could not open browser automatically"));
        console.log(theme.info(`  Open this URL manually: ${url}`));
      }
    } else {
      console.log(theme.info(`\nDashboard URL: ${url}`));
    }
    console.log();
  });
