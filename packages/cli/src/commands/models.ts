import { Command } from "commander";
import path from "node:path";
import { getDataDir, ModelStore, getModelDefinitions, AVAILABLE_PROVIDERS } from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const modelsCommand = new Command("models")
  .description("Manage available models");

modelsCommand
  .command("available")
  .description("List available models for a provider")
  .argument("<provider>", "Provider ID (e.g. anthropic, openai, google)")
  .action(async (providerId: string) => {
    const models = getModelDefinitions(providerId);

    if (models.length === 0) {
      console.log(theme.muted(`No hardcoded models for provider "${providerId}".`));
      console.log(theme.muted("This provider may fetch models dynamically from its API."));
      return;
    }

    console.log(theme.heading(`\n Models for ${providerId}\n`));
    for (const m of models) {
      const pricing = m.inputPricePer1m != null
        ? theme.muted(` ($${m.inputPricePer1m}/$${m.outputPricePer1m} per 1M)`)
        : "";
      console.log(`  ${theme.muted("•")} ${theme.command(m.id)} ${theme.info(m.name)}${pricing}`);
    }
    console.log();
  });

modelsCommand
  .command("list")
  .description("List enabled models")
  .option("-p, --provider <provider>", "Filter by provider")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const modelStore = new ModelStore(dbPath);
    const models = modelStore.list(opts.provider);

    if (models.length === 0) {
      console.log(theme.muted("No models enabled."));
      console.log(theme.muted("Enable models with: cortask models enable <provider> <model-id> <label> <input-price> <output-price>"));
      return;
    }

    console.log(theme.heading("\n Enabled Models\n"));
    for (const m of models) {
      console.log(`  ${theme.success("✓")} ${theme.command(m.label)} ${theme.muted(`(${m.provider}/${m.modelId})`)}`);
      console.log(`    ${theme.muted(`$${m.inputPricePer1m}/$${m.outputPricePer1m} per 1M tokens`)}`);
    }
    console.log();
  });

modelsCommand
  .command("enable")
  .description("Enable a model")
  .argument("<provider>", "Provider ID")
  .argument("<model-id>", "Model ID")
  .argument("<label>", "Display label")
  .argument("<input-price>", "Input price per 1M tokens (USD)")
  .argument("<output-price>", "Output price per 1M tokens (USD)")
  .action(async (provider: string, modelId: string, label: string, inputPrice: string, outputPrice: string) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const modelStore = new ModelStore(dbPath);

    const model = modelStore.enable(
      provider,
      modelId,
      label,
      parseFloat(inputPrice),
      parseFloat(outputPrice),
    );

    console.log(`${theme.success("✓")} Enabled model ${theme.command(model.label)} ${theme.muted(`(${provider}/${modelId})`)}`);
  });

modelsCommand
  .command("disable")
  .description("Disable a model")
  .argument("<provider>", "Provider ID")
  .argument("<model-id>", "Model ID")
  .action(async (provider: string, modelId: string) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const modelStore = new ModelStore(dbPath);

    modelStore.disable(provider, modelId);
    console.log(`${theme.success("✓")} Disabled model ${theme.muted(`${provider}/${modelId}`)}`);
  });
