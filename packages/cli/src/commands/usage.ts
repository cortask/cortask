import { Command } from "commander";
import path from "node:path";
import { getDataDir, UsageStore, ModelStore } from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const usageCommand = new Command("usage")
  .description("View token usage and costs");

usageCommand
  .command("summary")
  .description("Show usage summary for a period")
  .option("-p, --period <period>", "Period: daily, weekly, monthly", "monthly")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const modelStore = new ModelStore(dbPath);
    const usageStore = new UsageStore(dbPath, modelStore);
    const period = opts.period as "daily" | "weekly" | "monthly";

    const summary = usageStore.getSummary(period);

    console.log(theme.heading(`\n Usage (${period})`));
    console.log(`  Requests:      ${theme.info(String(summary.recordCount))}`);
    console.log(`  Input tokens:  ${theme.info(summary.totalInputTokens.toLocaleString())}`);
    console.log(`  Output tokens: ${theme.info(summary.totalOutputTokens.toLocaleString())}`);
    console.log(`  Total tokens:  ${theme.info(summary.totalTokens.toLocaleString())}`);
    console.log(`  Total cost:    ${theme.info(`$${summary.totalCostUsd.toFixed(4)}`)}`);
    console.log();
  });

usageCommand
  .command("history")
  .description("Show daily usage history")
  .option("-d, --days <days>", "Number of days", "14")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const modelStore = new ModelStore(dbPath);
    const usageStore = new UsageStore(dbPath, modelStore);
    const days = parseInt(opts.days, 10);

    const history = usageStore.getHistory(days);

    if (history.length === 0) {
      console.log(theme.muted("No usage data found."));
      return;
    }

    console.log(theme.heading(`\n Usage History (last ${days} days)\n`));
    console.log(`  ${theme.muted("Date".padEnd(12))} ${theme.muted("Tokens".padStart(12))} ${theme.muted("Cost".padStart(10))}`);
    console.log(`  ${theme.muted("─".repeat(34))}`);

    for (const row of history) {
      const date = row.date.padEnd(12);
      const tokens = row.tokens.toLocaleString().padStart(12);
      const cost = `$${row.costUsd.toFixed(4)}`.padStart(10);
      console.log(`  ${theme.info(date)} ${tokens} ${theme.muted(cost)}`);
    }
    console.log();
  });
