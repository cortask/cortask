import chalk, { Chalk } from "chalk";

const PALETTE = {
  accent: "#6366f1",
  accentBright: "#818cf8",
  accentDim: "#a5b4fc",
  info: "#38bdf8",
  success: "#22c55e",
  warn: "#f59e0b",
  error: "#ef4444",
  muted: "#9ca3af",
};

const hasForceColor =
  typeof process.env.FORCE_COLOR === "string" &&
  process.env.FORCE_COLOR.trim().length > 0 &&
  process.env.FORCE_COLOR.trim() !== "0";

const baseChalk =
  process.env.NO_COLOR && !hasForceColor
    ? new Chalk({ level: 0 })
    : chalk;

const hex = (value: string) => baseChalk.hex(value);

export const theme = {
  accent: hex(PALETTE.accent),
  accentBright: hex(PALETTE.accentBright),
  accentDim: hex(PALETTE.accentDim),
  info: hex(PALETTE.info),
  success: hex(PALETTE.success),
  warn: hex(PALETTE.warn),
  error: hex(PALETTE.error),
  muted: hex(PALETTE.muted),
  heading: baseChalk.bold.hex(PALETTE.accent),
  command: hex(PALETTE.accentBright),
  option: hex(PALETTE.warn),
} as const;

export const isRich = () => Boolean(baseChalk.level > 0);
