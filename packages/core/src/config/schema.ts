import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const providerConfigSchema = z.object({
  model: z.string().optional(),
});

const agentConfigSchema = z.object({
  maxTurns: z.number().int().min(1).max(200).default(25),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
});

const telegramChannelSchema = z.object({
  enabled: z.boolean().default(false),
  allowedUsers: z.array(z.string()).default([]),
});

const channelsConfigSchema = z.object({
  telegram: telegramChannelSchema.default({}),
});

const skillsConfigSchema = z.object({
  dirs: z.array(z.string()).default([]),
});

const spendingLimitSchema = z.object({
  enabled: z.boolean().default(false),
  maxTokens: z.number().int().nonnegative().optional(),
  maxCostUsd: z.number().nonnegative().optional(),
  period: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});

const memoryConfigSchema = z.object({
  embeddingProvider: z.enum(["local", "openai", "google", "ollama"]).default("local"),
  embeddingModel: z.string().optional(),
});

const serverConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3777),
  host: z.string().default("127.0.0.1"),
});

export const cortaskConfigSchema = z.object({
  onboarded: z.boolean().default(false),
  workspace: z
    .object({
      defaultDir: z.string().optional(),
    })
    .default({}),
  providers: z
    .object({
      default: z.string().default("anthropic"),
      anthropic: providerConfigSchema.default({}),
      openai: providerConfigSchema.default({}),
      google: providerConfigSchema.default({}),
      moonshot: providerConfigSchema.default({}),
      grok: providerConfigSchema.default({}),
      openrouter: providerConfigSchema.default({}),
      minimax: providerConfigSchema.default({}),
      ollama: providerConfigSchema.default({}),
    })
    .default({}),
  agent: agentConfigSchema.default({}),
  spending: spendingLimitSchema.default({}),
  channels: channelsConfigSchema.default({}),
  skills: skillsConfigSchema.default({}),
  memory: memoryConfigSchema.default({}),
  server: serverConfigSchema.default({}),
});

export type CortaskConfig = z.infer<typeof cortaskConfigSchema>;

export async function loadConfig(configPath: string): Promise<CortaskConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    // Simple env var substitution: ${ENV_VAR}
    const resolved = raw.replace(/\$\{(\w+)\}/g, (_, name) => {
      return process.env[name] ?? "";
    });

    // Dynamic import of yaml parser — use JSON as fallback
    let parsed: unknown;
    if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
      // Use a simple YAML subset parser or require yaml package
      const { parse } = await import("yaml" as string).catch(() => ({
        parse: (s: string) => JSON.parse(s),
      }));
      parsed = parse(resolved);
    } else {
      parsed = JSON.parse(resolved);
    }

    return cortaskConfigSchema.parse(parsed);
  } catch {
    // Return defaults if no config file exists
    return cortaskConfigSchema.parse({});
  }
}

export async function saveConfig(
  configPath: string,
  config: CortaskConfig,
): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });

  if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    const { stringify } = await import("yaml" as string).catch(() => ({
      stringify: (obj: unknown) => JSON.stringify(obj, null, 2),
    }));
    await fs.writeFile(configPath, stringify(config), "utf-8");
  } else {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }
}

export function getDataDir(): string {
  if (process.env.CORTASK_DATA_DIR) {
    return process.env.CORTASK_DATA_DIR;
  }
  const home =
    process.env.HOME || process.env.USERPROFILE || process.cwd();
  return path.join(home, ".cortask");
}
