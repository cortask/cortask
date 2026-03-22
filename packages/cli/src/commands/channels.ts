import { Command } from "commander";
import path from "node:path";
import { getDataDir, loadConfig } from "@cortask/core";
import { theme } from "../terminal/theme.js";

async function fetchGateway(host: string, port: number, path: string, method = "GET"): Promise<unknown> {
  const res = await fetch(`http://${host}:${port}${path}`, { method });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gateway returned ${res.status}: ${body}`);
  }
  return res.json();
}

export const channelsCommand = new Command("channels")
  .description("Manage messaging channels (requires running gateway)");

channelsCommand
  .command("list")
  .description("List channel statuses")
  .action(async () => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    try {
      const channels = await fetchGateway(
        config.server.host,
        config.server.port,
        "/api/channels",
      ) as Array<{ id: string; name: string; running: boolean; authenticated?: boolean }>;

      if (channels.length === 0) {
        console.log(theme.muted("No channels available."));
        return;
      }

      for (const ch of channels) {
        const statusIcon = ch.running ? theme.success("●") : theme.muted("○");
        const status = ch.running ? theme.success("running") : theme.muted("stopped");
        const auth = ch.authenticated != null
          ? (ch.authenticated ? theme.success(" (authenticated)") : theme.warn(" (not authenticated)"))
          : "";
        console.log(`  ${statusIcon} ${theme.command(ch.name)} ${status}${auth}`);
      }
    } catch (err) {
      console.error(theme.error(`✗ ${err instanceof Error ? err.message : String(err)}`));
      console.error(theme.muted("  Is the gateway running? Start it with: cortask serve"));
      process.exit(1);
    }
  });

channelsCommand
  .command("start")
  .description("Start a channel")
  .argument("<channel>", "Channel ID (telegram, discord, whatsapp)")
  .action(async (channelId: string) => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    try {
      await fetchGateway(
        config.server.host,
        config.server.port,
        `/api/channels/${channelId}/start`,
        "POST",
      );
      console.log(`${theme.success("✓")} Channel ${theme.command(channelId)} started`);
    } catch (err) {
      console.error(theme.error(`✗ ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

channelsCommand
  .command("stop")
  .description("Stop a channel")
  .argument("<channel>", "Channel ID (telegram, discord, whatsapp)")
  .action(async (channelId: string) => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    try {
      await fetchGateway(
        config.server.host,
        config.server.port,
        `/api/channels/${channelId}/stop`,
        "POST",
      );
      console.log(`${theme.success("✓")} Channel ${theme.command(channelId)} stopped`);
    } catch (err) {
      console.error(theme.error(`✗ ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });
