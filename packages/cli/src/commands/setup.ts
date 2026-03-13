import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "@cortask/core";
import { theme } from "../terminal/theme.js";

const DEFAULT_CONFIG = `# Cortask Configuration
onboarded: true

providers:
  default: anthropic

agent:
  maxTurns: 25
  temperature: 0.7

server:
  port: 3777
  host: 127.0.0.1

skills:
  dirs: []
`;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const setupCommand = new Command("setup")
  .description("Initialize configuration and data directory")
  .option("--force", "Overwrite existing configuration")
  .action(async (opts: { force?: boolean }) => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");

    console.log(theme.heading("\n⚡ Cortask Setup\n"));

    if (fs.existsSync(configPath) && !opts.force) {
      console.log(theme.warn("⚠ Configuration already exists:"));
      console.log(theme.info(`  ${configPath}`));
      console.log(theme.muted("\n  Use --force to overwrite"));
      console.log();
      process.exit(1);
    }

    try {
      ensureDir(dataDir);
      console.log(`${theme.success("✓")} Data directory: ${theme.info(dataDir)}`);

      fs.writeFileSync(configPath, DEFAULT_CONFIG, "utf-8");
      console.log(`${theme.success("✓")} Config: ${theme.info(configPath)}`);

      const skillsDir = path.join(dataDir, "skills");
      ensureDir(skillsDir);
      console.log(`${theme.success("✓")} Skills: ${theme.info(skillsDir)}`);

      console.log(theme.heading("\n✓ Setup complete!\n"));

      console.log(theme.muted("Next steps:"));
      console.log(theme.command("  1. Set your API key:"));
      console.log(theme.info(`     cortask credentials set provider.anthropic.apiKey YOUR_KEY`));
      console.log(theme.command("\n  2. Add a workspace:"));
      console.log(theme.info("     cortask workspaces add my-project /path/to/project"));
      console.log(theme.command("\n  3. Start chatting:"));
      console.log(theme.info("     cortask chat -w /path/to/project"));
      console.log();
    } catch (err) {
      console.error(theme.error("\n✗ Setup failed"));
      console.error(theme.muted(`  ${(err as Error).message}`));
      process.exit(1);
    }
  });
