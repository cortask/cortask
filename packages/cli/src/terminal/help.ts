import type { Command } from "commander";
import { emitBanner, hasBannerEmitted } from "./banner.js";
import { theme } from "./theme.js";

const EXAMPLES = [
  ["cortask serve", "Start the gateway server"],
  ["cortask chat", "Start interactive chat session"],
  ["cortask run \"hello\"", "Run a one-shot prompt"],
  ["cortask status", "Show system status"],
  ["cortask dashboard", "Open the web UI"],
  ["cortask setup", "Initialize configuration"],
  ["cortask workspaces list", "List registered workspaces"],
  ["cortask credentials set provider.anthropic.apiKey KEY", "Set API key"],
] as const;

export function configureHelp(program: Command, version: string) {
  program.helpOption("-h, --help", "Display help for command");
  program.helpCommand("help [command]", "Display help for command");

  program.configureHelp({
    sortSubcommands: true,
    sortOptions: true,
    optionTerm: (option) => theme.option(option.flags),
    subcommandTerm: (cmd) => theme.command(cmd.name()),
  });

  const formatHelp = (str: string) =>
    str
      .replace(/^Usage:/gm, theme.heading("Usage:"))
      .replace(/^Options:/gm, theme.heading("Options:"))
      .replace(/^Commands:/gm, theme.heading("Commands:"))
      .replace(/^Arguments:/gm, theme.heading("Arguments:"));

  program.configureOutput({
    writeOut: (str) => process.stdout.write(formatHelp(str)),
    writeErr: (str) => process.stderr.write(formatHelp(str)),
    outputError: (str, write) => write(theme.error(str)),
  });

  program.addHelpText("beforeAll", () => {
    if (hasBannerEmitted()) return "";
    emitBanner(version);
    return "";
  });

  const fmtExamples = EXAMPLES.map(
    ([cmd, desc]) => `  ${theme.command(cmd)}\n    ${theme.muted(desc)}`,
  ).join("\n");

  program.addHelpText("afterAll", ({ command }) => {
    if (command !== program) return "";
    return `\n${theme.heading("Examples:")}\n${fmtExamples}\n`;
  });
}
