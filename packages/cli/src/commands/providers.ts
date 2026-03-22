import { Command } from "commander";
import path from "node:path";
import {
  getDataDir,
  loadConfig,
  saveConfig,
  EncryptedCredentialStore,
  getOrCreateSecret,
  createProvider,
  AVAILABLE_PROVIDERS,
  getModelDefinitions,
  type ProviderId,
} from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const providersCommand = new Command("providers")
  .description("Manage LLM providers");

providersCommand
  .command("list")
  .description("List all available providers and their status")
  .action(async () => {
    const dataDir = getDataDir();
    const config = await loadConfig(path.join(dataDir, "config.yaml"));
    const secret = await getOrCreateSecret(dataDir);
    const credentialStore = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );

    const defaultProvider = config.providers.default;

    for (const p of AVAILABLE_PROVIDERS) {
      const apiKey = await credentialStore.get(`provider.${p.id}.apiKey`);
      const configured = p.requiresApiKey ? !!apiKey : true;
      const isDefault = p.id === defaultProvider;
      const icon = configured ? theme.success("✓") : theme.muted("○");
      const defaultTag = isDefault ? theme.accent(" [default]") : "";
      const providerConfig = config.providers[p.id as keyof typeof config.providers];
      const model = typeof providerConfig === "object" && providerConfig && "model" in providerConfig
        ? (providerConfig as { model?: string }).model
        : undefined;
      const modelTag = model ? theme.muted(` (${model})`) : "";

      console.log(`  ${icon} ${theme.command(p.name)}${defaultTag}${modelTag}`);
    }
  });

providersCommand
  .command("default")
  .description("Set the default provider and optionally model")
  .argument("<provider>", "Provider ID (e.g. anthropic, openai, google)")
  .argument("[model]", "Model ID")
  .action(async (providerId: string, model?: string) => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");
    const config = await loadConfig(configPath);

    const valid = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
    if (!valid) {
      console.error(theme.error(`✗ Unknown provider: ${providerId}`));
      console.error(theme.muted("  Valid providers: " + AVAILABLE_PROVIDERS.map((p) => p.id).join(", ")));
      process.exit(1);
    }

    config.providers.default = providerId;
    if (model) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config.providers as any)[providerId] = {
        ...(config.providers as any)[providerId],
        model,
      };
    }

    await saveConfig(configPath, config);
    console.log(`${theme.success("✓")} Default provider set to ${theme.command(valid.name)}${model ? ` with model ${theme.info(model)}` : ""}`);
  });

providersCommand
  .command("test")
  .description("Test provider credentials with a simple API call")
  .argument("<provider>", "Provider ID")
  .action(async (providerId: string) => {
    const dataDir = getDataDir();
    const secret = await getOrCreateSecret(dataDir);
    const credentialStore = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );
    const config = await loadConfig(path.join(dataDir, "config.yaml"));

    const valid = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
    if (!valid) {
      console.error(theme.error(`✗ Unknown provider: ${providerId}`));
      process.exit(1);
    }

    const apiKey = await credentialStore.get(`provider.${providerId}.apiKey`);
    if (!apiKey && valid.requiresApiKey) {
      console.error(theme.error(`✗ No API key set for ${providerId}`));
      console.error(theme.muted(`  Set it with: cortask credentials set provider.${providerId}.apiKey YOUR_KEY`));
      process.exit(1);
    }

    console.log(theme.muted(`Testing ${valid.name}...`));

    try {
      const provider = createProvider(providerId as ProviderId, apiKey ?? "");
      const providerConfig = config.providers[providerId as keyof typeof config.providers];
      const model = typeof providerConfig === "object" && providerConfig && "model" in providerConfig
        ? (providerConfig as { model?: string }).model
        : undefined;

      const defaultModel = getModelDefinitions(providerId)[0]?.id;
      const result = await provider.generateText({
        model: model ?? defaultModel ?? providerId,
        messages: [{ role: "user", content: [{ type: "text", text: "Say hi in exactly one word." }] }],
        maxTokens: 20,
      });

      console.log(`${theme.success("✓")} Provider responded successfully`);
      console.log(`  ${theme.muted("Response:")} ${result.content}`);
      if (result.usage) {
        console.log(`  ${theme.muted("Tokens:")} ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
      }
    } catch (err) {
      console.error(`${theme.error("✗")} Provider test failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
