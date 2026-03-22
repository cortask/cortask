import { Command } from "commander";
import path from "node:path";
import { getDataDir, loadConfig, saveConfig } from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const configCommand = new Command("config")
  .description("View and update configuration");

configCommand
  .command("show")
  .description("Show current configuration")
  .action(async () => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    console.log(theme.heading("\n Agent"));
    console.log(`  Max turns:   ${theme.info(String(config.agent.maxTurns))}`);
    console.log(`  Temperature: ${theme.info(String(config.agent.temperature))}`);
    console.log(`  Max tokens:  ${theme.info(config.agent.maxTokens ? String(config.agent.maxTokens) : "default")}`);

    console.log(theme.heading("\n Server"));
    console.log(`  Host: ${theme.info(config.server.host)}`);
    console.log(`  Port: ${theme.info(String(config.server.port))}`);

    console.log(theme.heading("\n Spending"));
    console.log(`  Enabled:    ${config.spending.enabled ? theme.success("yes") : theme.muted("no")}`);
    console.log(`  Max tokens: ${theme.info(config.spending.maxTokens ? String(config.spending.maxTokens) : "unlimited")}`);
    console.log(`  Max cost:   ${theme.info(config.spending.maxCostUsd ? `$${config.spending.maxCostUsd}` : "unlimited")}`);
    console.log(`  Period:     ${theme.info(config.spending.period)}`);

    console.log(theme.heading("\n Memory"));
    console.log(`  Embedding provider: ${theme.info(config.memory.embeddingProvider)}`);
    if (config.memory.embeddingModel) {
      console.log(`  Embedding model:    ${theme.info(config.memory.embeddingModel)}`);
    }

    console.log(theme.heading("\n Skills"));
    if (config.skills.dirs.length > 0) {
      for (const dir of config.skills.dirs) {
        console.log(`  ${theme.muted("•")} ${theme.info(dir)}`);
      }
    } else {
      console.log(`  ${theme.muted("No custom skill directories")}`);
    }

    console.log();
  });

configCommand
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "Config key (e.g. agent.maxTurns, server.port, spending.enabled)")
  .argument("<value>", "Config value")
  .action(async (key: string, value: string) => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");
    const config = await loadConfig(configPath);

    const parts = key.split(".");
    if (parts.length !== 2) {
      console.error(theme.error("✗ Key must be in format section.field (e.g. agent.maxTurns)"));
      process.exit(1);
    }

    const [section, field] = parts;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = config as any;
    if (!(section in cfg) || typeof cfg[section] !== "object") {
      console.error(theme.error(`✗ Unknown config section: ${section}`));
      console.error(theme.muted("  Valid sections: agent, server, spending, memory, skills"));
      process.exit(1);
    }

    // Parse value to correct type
    let parsed: unknown = value;
    if (value === "true") parsed = true;
    else if (value === "false") parsed = false;
    else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);
    else if (/^\d+\.\d+$/.test(value)) parsed = parseFloat(value);

    cfg[section][field] = parsed;

    await saveConfig(configPath, config);
    console.log(`${theme.success("✓")} Set ${theme.command(key)} = ${theme.info(String(parsed))}`);
  });

configCommand
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "Config key (e.g. agent.maxTurns)")
  .action(async (key: string) => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    const parts = key.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = config;
    for (const part of parts) {
      if (current == null || typeof current !== "object" || !(part in current)) {
        console.error(theme.error(`✗ Unknown config key: ${key}`));
        process.exit(1);
      }
      current = current[part];
    }

    console.log(typeof current === "object" ? JSON.stringify(current, null, 2) : String(current));
  });
