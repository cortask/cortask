import { Command } from "commander";
import {
  loadConfig,
  getDataDir,
  WorkspaceManager,
  SessionStore,
  EncryptedCredentialStore,
  getOrCreateSecret,
  createProvider,
  AgentRunner,
  builtinTools,
  createCronTool,
  createArtifactTool,
  loadSkills,
  getEligibleSkills,
  buildSkillTools,
  CronService,
  ArtifactStore,
  installSkillFromGit,
  removeSkill,
  type ProviderId,
  type ToolHandler,
} from "@cortask/core";
import path from "node:path";
import readline from "node:readline";
import { theme } from "./terminal/theme.js";
import { emitBanner } from "./terminal/banner.js";
import { configureHelp } from "./terminal/help.js";
import { setupCommand } from "./commands/setup.js";
import { statusCommand } from "./commands/status.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const VERSION: string = require("../package.json").version;

const program = new Command();

program
  .name("cortask")
  .description("Cortask — Local AI agent with skills, workspaces, and cron")
  .version(VERSION);

// Configure themed help and banner
configureHelp(program, VERSION);

// ── serve ──────────────────────────────────────────────────

program
  .command("serve")
  .description("Start the gateway server")
  .option("-p, --port <port>", "Port to listen on", "3777")
  .option("--host <host>", "Host to bind to", "127.0.0.1")
  .action(async (opts) => {
    emitBanner(VERSION);
    const { startServer } = await import("@cortask/gateway");
    console.log(
      `${theme.muted("Starting gateway on")} ${theme.info(`http://${opts.host}:${opts.port}`)}`,
    );
    await startServer(parseInt(opts.port, 10), opts.host);
  });

// ── chat ───────────────────────────────────────────────────

program
  .command("chat")
  .description("Interactive chat REPL")
  .option("-w, --workspace <path>", "Workspace directory path", ".")
  .action(async (opts) => {
    emitBanner(VERSION);
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");
    const config = await loadConfig(configPath);
    const dbPath = path.join(dataDir, "cortask.db");
    const workspaceManager = new WorkspaceManager(dbPath);
    const secret = await getOrCreateSecret(dataDir);
    const credentialStore = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );
    const cronService = new CronService(dbPath);
    const artifactStore = new ArtifactStore();

    // Resolve workspace
    const workspacePath = path.resolve(opts.workspace);
    const workspaces = await workspaceManager.list();
    let workspace = workspaces.find((w) => w.rootPath === workspacePath);
    if (!workspace) {
      workspace = await workspaceManager.create(
        path.basename(workspacePath),
        workspacePath,
      );
      console.log(
        `${theme.success("✓")} Registered workspace: ${theme.command(workspace.name)}`,
      );
    }

    const sessionStore = new SessionStore(
      workspaceManager.getSessionDbPath(workspacePath),
    );

    // Load skills
    const bundledSkillsDir = path.resolve("skills");
    const userSkillsDir = path.join(dataDir, "skills");
    const allSkills = await loadSkills(
      bundledSkillsDir,
      userSkillsDir,
      config.skills.dirs,
      credentialStore,
    );
    const eligible = getEligibleSkills(allSkills);
    const skillRegistry = await buildSkillTools(eligible, credentialStore);
    const skillToolHandlers: ToolHandler[] = skillRegistry.toolDefs.map((def) => ({
      definition: def,
      execute: async (args: Record<string, unknown>, context: Parameters<ToolHandler["execute"]>[1]) => {
        const handler = skillRegistry.handlers.get(def.name);
        if (!handler) return { toolCallId: "", content: "Tool not found", isError: true };
        return handler(args);
      },
    }));
    const skillPrompts = eligible
      .map((s) => s.content)
      .filter(Boolean);

    // Build provider
    const providerId = (config.providers.default || "anthropic") as ProviderId;
    const providerConfig = config.providers[providerId];
    const apiKey = await credentialStore.get(`provider.${providerId}.apiKey`);
    if (!apiKey) {
      console.error(theme.error(`\n✗ No API key for provider "${providerId}"`));
      console.error(theme.muted("  Set it with:"));
      console.error(
        theme.command(
          `  cortask credentials set provider.${providerId}.apiKey YOUR_KEY`,
        ),
      );
      console.log();
      process.exit(1);
    }
    const provider = createProvider(providerId, apiKey);
    const model =
      ((providerConfig as Record<string, unknown>)?.model as string) ??
      "claude-sonnet-4-5-20250929";

    const sessionId = `cli_${Date.now()}`;

    const runner = new AgentRunner({
      config: {
        provider,
        model,
        maxTurns: config.agent.maxTurns,
        temperature: config.agent.temperature,
        maxTokens: config.agent.maxTokens,
      },
      tools: [
        ...builtinTools,
        createCronTool(cronService),
        createArtifactTool(artifactStore),
        ...skillToolHandlers,
      ],
      getWorkspacePath: () => workspacePath,
      getDataDir: () => dataDir,
      getMemoryContent: () => workspaceManager.readMemory(workspacePath),
      getGlobalMemoryContent: () => workspaceManager.readGlobalMemory(dataDir),
      getSkillPrompts: () => skillPrompts,
      getSessionMessages: async (sid) => sessionStore.getMessages(sid),
      saveSessionMessages: async (sid, msgs) =>
        sessionStore.saveMessages(sid, msgs),
    });

    console.log(
      `${theme.muted("Workspace:")} ${theme.info(workspacePath)}`,
    );
    console.log(
      `${theme.muted("Provider:")} ${theme.command(providerId)} ${theme.muted(`(${model})`)}`,
    );
    console.log(
      theme.muted("Type a message, /help for commands, /quit to exit.\n"),
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${theme.accent("you>")} `,
    });

    rl.prompt();

    rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      // Slash commands
      if (input.startsWith("/")) {
        const cmd = input.toLowerCase();
        if (cmd === "/quit" || cmd === "/exit") {
          rl.close();
          return;
        }
        if (cmd === "/help") {
          console.log(theme.heading("\nCommands:"));
          console.log(`  ${theme.command("/help")}   ${theme.muted("Show this help")}`);
          console.log(`  ${theme.command("/quit")}   ${theme.muted("Exit the REPL")}`);
          console.log();
          rl.prompt();
          return;
        }
        console.log(theme.warn(`Unknown command: ${input}. Type /help for commands.`));
        rl.prompt();
        return;
      }

      process.stdout.write(`\n${theme.accentBright("cortask>")} `);
      try {
        for await (const event of runner.runStream({
          prompt: input,
          sessionId,
        })) {
          if (event.type === "text_delta" && event.text) {
            process.stdout.write(event.text);
          } else if (event.type === "tool_call_start") {
            process.stdout.write(
              `\n${theme.muted("[")}${theme.warn("tool")}${theme.muted(":")} ${theme.command(event.toolName)}${theme.muted("]")} `,
            );
          } else if (event.type === "tool_result") {
            const preview = event.toolResult?.content?.slice(0, 200) ?? "";
            process.stdout.write(`${theme.muted("→")} ${theme.muted(preview)}\n`);
          }
        }
      } catch (err) {
        console.error(
          theme.error(
            `\n✗ ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
      process.stdout.write("\n\n");
      rl.prompt();
    });

    rl.on("close", () => {
      console.log(theme.muted("\nGoodbye."));
      workspaceManager.close();
      process.exit(0);
    });
  });

// ── run ────────────────────────────────────────────────────

program
  .command("run")
  .description("Run a one-shot prompt")
  .argument("<prompt>", "The prompt to execute")
  .option("-w, --workspace <path>", "Workspace directory path", ".")
  .action(async (prompt, opts) => {
    const dataDir = getDataDir();
    const configPath = path.join(dataDir, "config.yaml");
    const config = await loadConfig(configPath);
    const dbPath = path.join(dataDir, "cortask.db");
    const workspaceManager = new WorkspaceManager(dbPath);
    const secret = await getOrCreateSecret(dataDir);
    const credentialStore = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );
    const cronService = new CronService(dbPath);
    const artifactStore = new ArtifactStore();

    const workspacePath = path.resolve(opts.workspace);
    const workspaces = await workspaceManager.list();
    let workspace = workspaces.find((w) => w.rootPath === workspacePath);
    if (!workspace) {
      workspace = await workspaceManager.create(
        path.basename(workspacePath),
        workspacePath,
      );
    }

    const sessionStore = new SessionStore(
      workspaceManager.getSessionDbPath(workspacePath),
    );

    const providerId = (config.providers.default || "anthropic") as ProviderId;
    const apiKey = await credentialStore.get(`provider.${providerId}.apiKey`);
    if (!apiKey) {
      console.error(theme.error(`\n✗ No API key for provider "${providerId}".`));
      console.error(theme.muted("  Set it with:"));
      console.error(
        theme.command(
          `  cortask credentials set provider.${providerId}.apiKey YOUR_KEY`,
        ),
      );
      process.exit(1);
    }
    const provider = createProvider(providerId, apiKey);
    const providerConfig = config.providers[providerId];
    const model =
      ((providerConfig as Record<string, unknown>)?.model as string) ??
      "claude-sonnet-4-5-20250929";

    const runner = new AgentRunner({
      config: {
        provider,
        model,
        maxTurns: config.agent.maxTurns,
        temperature: config.agent.temperature,
        maxTokens: config.agent.maxTokens,
      },
      tools: [
        ...builtinTools,
        createCronTool(cronService),
        createArtifactTool(artifactStore),
      ],
      getWorkspacePath: () => workspacePath,
      getDataDir: () => dataDir,
      getMemoryContent: () => workspaceManager.readMemory(workspacePath),
      getGlobalMemoryContent: () => workspaceManager.readGlobalMemory(dataDir),
      getSkillPrompts: () => [],
      getSessionMessages: async (sid) => sessionStore.getMessages(sid),
      saveSessionMessages: async (sid, msgs) =>
        sessionStore.saveMessages(sid, msgs),
    });

    const result = await runner.run({ prompt });
    console.log(result.response);

    workspaceManager.close();
  });

// ── setup, status, dashboard ──────────────────────────────

program.addCommand(setupCommand);
program.addCommand(statusCommand);
program.addCommand(dashboardCommand);

// ── workspaces ─────────────────────────────────────────────

const ws = program.command("workspaces").description("Manage workspaces");

ws.command("list").action(async () => {
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "cortask.db");
  const wm = new WorkspaceManager(dbPath);
  const list = await wm.list();
  if (list.length === 0) {
    console.log(theme.muted("No workspaces registered."));
  } else {
    for (const w of list) {
      console.log(
        `  ${theme.success("✓")} ${theme.command(w.name)} ${theme.muted("→")} ${theme.info(w.rootPath)} ${theme.muted(`(${w.id})`)}`,
      );
    }
  }
  wm.close();
});

ws.command("add")
  .argument("<name>", "Workspace name")
  .argument("<path>", "Workspace directory path")
  .action(async (name, dirPath) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const wm = new WorkspaceManager(dbPath);
    const workspace = await wm.create(name, dirPath);
    console.log(
      `${theme.success("✓")} Created workspace ${theme.command(workspace.name)} ${theme.muted(`(${workspace.id})`)}`,
    );
    console.log(`  ${theme.muted("Path:")} ${theme.info(workspace.rootPath)}`);
    wm.close();
  });

ws.command("remove")
  .argument("<id>", "Workspace ID")
  .action(async (id) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const wm = new WorkspaceManager(dbPath);
    await wm.delete(id);
    console.log(`${theme.success("✓")} Removed workspace ${theme.muted(id)}`);
    wm.close();
  });

// ── credentials ────────────────────────────────────────────

const creds = program
  .command("credentials")
  .description("Manage credentials");

creds.command("list").action(async () => {
  const dataDir = getDataDir();
  const secret = await getOrCreateSecret(dataDir);
  const store = new EncryptedCredentialStore(
    path.join(dataDir, "credentials.enc.json"),
    secret,
  );
  const keys = await store.list();
  if (keys.length === 0) {
    console.log(theme.muted("No credentials stored."));
  } else {
    for (const key of keys) {
      console.log(`  ${theme.muted("•")} ${theme.command(key)}`);
    }
  }
});

creds
  .command("set")
  .argument("<key>", "Credential key (e.g. provider.anthropic.apiKey)")
  .argument("<value>", "Credential value")
  .action(async (key, value) => {
    const dataDir = getDataDir();
    const secret = await getOrCreateSecret(dataDir);
    const store = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );
    await store.set(key, value);
    console.log(`${theme.success("✓")} Credential ${theme.command(key)} saved.`);
  });

creds
  .command("remove")
  .argument("<key>", "Credential key")
  .action(async (key) => {
    const dataDir = getDataDir();
    const secret = await getOrCreateSecret(dataDir);
    const store = new EncryptedCredentialStore(
      path.join(dataDir, "credentials.enc.json"),
      secret,
    );
    await store.delete(key);
    console.log(`${theme.success("✓")} Credential ${theme.command(key)} removed.`);
  });

// ── skills ─────────────────────────────────────────────────

const sk = program.command("skills").description("Manage skills");

sk.command("list").action(async () => {
  const dataDir = getDataDir();
  const secret = await getOrCreateSecret(dataDir);
  const credentialStore = new EncryptedCredentialStore(
    path.join(dataDir, "credentials.enc.json"),
    secret,
  );
  const bundledSkillsDir = path.resolve("skills");
  const userSkillsDir = path.join(dataDir, "skills");
  const configPath = path.join(dataDir, "config.yaml");
  const config = await loadConfig(configPath);
  const allSkills = await loadSkills(
    bundledSkillsDir,
    userSkillsDir,
    config.skills.dirs,
    credentialStore,
  );
  if (allSkills.length === 0) {
    console.log(theme.muted("No skills found."));
  } else {
    for (const skill of allSkills) {
      const icon = skill.eligible ? theme.success("✓") : theme.muted("○");
      const name = theme.command(skill.manifest.name);
      const desc = theme.muted(skill.manifest.description ?? "");
      console.log(`  ${icon} ${name} ${desc}`);
    }
  }
});

sk.command("install")
  .argument("<git-url>", "Git URL of the skill repository")
  .action(async (gitUrl) => {
    const dataDir = getDataDir();
    const userSkillsDir = path.join(dataDir, "skills");
    const result = await installSkillFromGit(gitUrl, userSkillsDir);
    console.log(
      `${theme.success("✓")} Installed skill ${theme.command(result.name)}`,
    );
  });

sk.command("remove")
  .argument("<name>", "Skill name")
  .action(async (name) => {
    const dataDir = getDataDir();
    const userSkillsDir = path.join(dataDir, "skills");
    await removeSkill(name, userSkillsDir);
    console.log(`${theme.success("✓")} Removed skill ${theme.command(name)}`);
  });

// ── cron ───────────────────────────────────────────────────

const cr = program.command("cron").description("Manage cron jobs");

cr.command("list").action(async () => {
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "cortask.db");
  const cronService = new CronService(dbPath);
  const jobs = cronService.list();
  if (jobs.length === 0) {
    console.log(theme.muted("No cron jobs."));
  } else {
    for (const job of jobs) {
      const icon = job.enabled ? theme.success("✓") : theme.muted("○");
      console.log(`  ${icon} ${theme.command(job.name)} ${theme.muted(`(${job.id})`)}`);
      console.log(`    ${theme.muted("Schedule:")} ${theme.info(JSON.stringify(job.schedule))}`);
      console.log(`    ${theme.muted("Prompt:")} ${job.prompt.slice(0, 80)}...`);
    }
  }
  cronService.stop();
});

cr.command("add")
  .requiredOption("-n, --name <name>", "Job name")
  .requiredOption("-s, --schedule <cron>", "Cron expression")
  .requiredOption("-p, --prompt <prompt>", "Prompt to execute")
  .option("-w, --workspace <id>", "Workspace ID")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const cronService = new CronService(dbPath);
    const job = cronService.add({
      name: opts.name,
      schedule: { type: "cron", expression: opts.schedule },
      prompt: opts.prompt,
      delivery: {},
      workspaceId: opts.workspace,
    });
    console.log(
      `${theme.success("✓")} Created cron job ${theme.command(job.name)} ${theme.muted(`(${job.id})`)}`,
    );
    cronService.stop();
  });

cr.command("remove")
  .argument("<id>", "Job ID")
  .action(async (id) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const cronService = new CronService(dbPath);
    cronService.remove(id);
    console.log(`${theme.success("✓")} Deleted cron job ${theme.muted(id)}`);
    cronService.stop();
  });

program.parse();
