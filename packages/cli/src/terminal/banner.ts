import { isRich, theme } from "./theme.js";

let bannerEmitted = false;

const hasFlag = (argv: string[], ...flags: string[]) =>
  argv.some((arg) => flags.includes(arg));

export function emitBanner(version: string, argv?: string[]) {
  if (bannerEmitted) return;
  const args = argv ?? process.argv;
  if (!process.stdout.isTTY) return;
  if (hasFlag(args, "--json", "--version", "-V")) return;

  const title = "⚡ Cortask";
  const tagline = "Local AI agent platform";

  if (isRich()) {
    process.stdout.write(
      `\n${theme.heading(title)} ${theme.info(version)} ${theme.muted("—")} ${theme.accentDim(tagline)}\n\n`,
    );
  } else {
    process.stdout.write(`\n${title} ${version} — ${tagline}\n\n`);
  }

  bannerEmitted = true;
}

export function hasBannerEmitted(): boolean {
  return bannerEmitted;
}
