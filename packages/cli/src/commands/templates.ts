import { Command } from "commander";
import path from "node:path";
import { getDataDir, TemplateStore } from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const templatesCommand = new Command("templates")
  .description("Manage prompt templates");

templatesCommand
  .command("list")
  .description("List all templates")
  .action(async () => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const store = new TemplateStore(dbPath);
    const templates = store.list();

    if (templates.length === 0) {
      console.log(theme.muted("No templates found."));
      return;
    }

    let currentCategory = "";
    for (const t of templates) {
      if (t.category !== currentCategory) {
        currentCategory = t.category;
        console.log(theme.heading(`\n ${currentCategory}`));
      }
      console.log(`  ${theme.muted("•")} ${theme.command(t.name)} ${theme.muted(`(${t.id.slice(0, 8)}...)`)}`);
      console.log(`    ${theme.muted(t.content.slice(0, 80).replace(/\n/g, " "))}${t.content.length > 80 ? "..." : ""}`);
    }
    console.log();
  });

templatesCommand
  .command("create")
  .description("Create a new template")
  .requiredOption("-n, --name <name>", "Template name")
  .requiredOption("-c, --content <content>", "Template content")
  .option("--category <category>", "Category", "General")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const store = new TemplateStore(dbPath);

    const template = store.create(opts.name, opts.content, opts.category);
    console.log(`${theme.success("✓")} Created template ${theme.command(template.name)} ${theme.muted(`(${template.id.slice(0, 8)}...)`)}`);
  });

templatesCommand
  .command("update")
  .description("Update a template")
  .argument("<id>", "Template ID")
  .option("-n, --name <name>", "New name")
  .option("-c, --content <content>", "New content")
  .option("--category <category>", "New category")
  .action(async (id, opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const store = new TemplateStore(dbPath);

    const updates: Record<string, string> = {};
    if (opts.name) updates.name = opts.name;
    if (opts.content) updates.content = opts.content;
    if (opts.category) updates.category = opts.category;

    if (Object.keys(updates).length === 0) {
      console.error(theme.error("✗ No fields to update. Use --name, --content, or --category."));
      process.exit(1);
    }

    const result = store.update(id, updates);
    if (!result) {
      console.error(theme.error(`✗ Template not found: ${id}`));
      process.exit(1);
    }

    console.log(`${theme.success("✓")} Updated template ${theme.command(result.name)}`);
  });

templatesCommand
  .command("delete")
  .description("Delete a template")
  .argument("<id>", "Template ID")
  .action(async (id) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const store = new TemplateStore(dbPath);

    store.delete(id);
    console.log(`${theme.success("✓")} Deleted template ${theme.muted(id)}`);
  });
