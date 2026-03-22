import { Command } from "commander";
import path from "node:path";
import { getDataDir, WorkspaceManager, SessionStore } from "@cortask/core";
import { theme } from "../terminal/theme.js";

export const sessionsCommand = new Command("sessions")
  .description("Manage chat sessions");

sessionsCommand
  .command("list")
  .description("List sessions for a workspace")
  .requiredOption("-w, --workspace <id>", "Workspace ID")
  .action(async (opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const wm = new WorkspaceManager(dbPath);
    const workspace = await wm.get(opts.workspace);

    if (!workspace) {
      console.error(theme.error(`✗ Workspace not found: ${opts.workspace}`));
      wm.close();
      process.exit(1);
    }

    const sessionStore = new SessionStore(wm.getSessionDbPath(workspace.rootPath));
    const sessions = sessionStore.listSessions();

    if (sessions.length === 0) {
      console.log(theme.muted("No sessions found."));
    } else {
      for (const s of sessions) {
        const date = new Date(s.updatedAt).toLocaleString();
        console.log(`  ${theme.muted("•")} ${theme.command(s.title || "Untitled")} ${theme.muted(`(${s.id})`)}`);
        console.log(`    ${theme.muted("Updated:")} ${date}`);
      }
    }
    wm.close();
  });

sessionsCommand
  .command("show")
  .description("Show session messages")
  .argument("<id>", "Session ID")
  .requiredOption("-w, --workspace <id>", "Workspace ID")
  .option("-n, --limit <count>", "Number of messages to show", "20")
  .action(async (id, opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const wm = new WorkspaceManager(dbPath);
    const workspace = await wm.get(opts.workspace);

    if (!workspace) {
      console.error(theme.error(`✗ Workspace not found: ${opts.workspace}`));
      wm.close();
      process.exit(1);
    }

    const sessionStore = new SessionStore(wm.getSessionDbPath(workspace.rootPath));
    const session = sessionStore.getSession(id);

    if (!session) {
      console.error(theme.error(`✗ Session not found: ${id}`));
      wm.close();
      process.exit(1);
    }

    console.log(theme.heading(`\n ${session.title || "Untitled Session"}`));
    console.log(theme.muted(`  ID: ${session.id}`));
    console.log(theme.muted(`  Created: ${new Date(session.createdAt).toLocaleString()}`));
    console.log();

    const limit = parseInt(opts.limit, 10);
    const messages = session.messages.slice(-limit);

    for (const msg of messages) {
      const role = msg.role === "user"
        ? theme.accent("you>")
        : theme.accentBright("cortask>");

      // Extract text content
      let text = "";
      if (typeof msg.content === "string") {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text?: string }) => c.text ?? "")
          .join("");
      }

      if (text) {
        console.log(`${role} ${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`);
        console.log();
      }
    }
    wm.close();
  });

sessionsCommand
  .command("delete")
  .description("Delete a session")
  .argument("<id>", "Session ID")
  .requiredOption("-w, --workspace <id>", "Workspace ID")
  .action(async (id, opts) => {
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, "cortask.db");
    const wm = new WorkspaceManager(dbPath);
    const workspace = await wm.get(opts.workspace);

    if (!workspace) {
      console.error(theme.error(`✗ Workspace not found: ${opts.workspace}`));
      wm.close();
      process.exit(1);
    }

    const sessionStore = new SessionStore(wm.getSessionDbPath(workspace.rootPath));
    sessionStore.deleteSession(id);
    console.log(`${theme.success("✓")} Deleted session ${theme.muted(id)}`);
    wm.close();
  });
