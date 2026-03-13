import Database from "better-sqlite3";
import fs from "node:fs";
import { logger } from "../logging/logger.js";

/**
 * Run database migrations on a session database.
 * This is separate from SessionStore to allow running migrations at startup
 * before any SessionStore instances are cached.
 */
export function migrateSessionDatabase(dbPath: string): void {
  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    logger.debug(`Session database does not exist yet: ${dbPath}`, "migration");
    return;
  }

  const db = new Database(dbPath);

  try {
    // Get current schema
    const columns = db
      .prepare("PRAGMA table_info(sessions)")
      .all() as Array<{ name: string }>;

    if (columns.length === 0) {
      logger.debug(`Sessions table does not exist yet in: ${dbPath}`, "migration");
      db.close();
      return;
    }

    const hasParentSessionId = columns.some((c) => c.name === "parent_session_id");
    const hasDepth = columns.some((c) => c.name === "depth");
    const hasChannel = columns.some((c) => c.name === "channel");

    let changesMade = false;

    // Add parent_session_id column
    if (!hasParentSessionId) {
      logger.info(`Migrating database: adding parent_session_id to ${dbPath}`, "migration");
      db.exec("ALTER TABLE sessions ADD COLUMN parent_session_id TEXT");
      changesMade = true;
      logger.info("✓ Added parent_session_id column", "migration");
    }

    // Add depth column
    if (!hasDepth) {
      logger.info(`Migrating database: adding depth to ${dbPath}`, "migration");
      db.exec("ALTER TABLE sessions ADD COLUMN depth INTEGER DEFAULT 0");
      changesMade = true;
      logger.info("✓ Added depth column", "migration");
    }

    // Add channel column
    if (!hasChannel) {
      logger.info(`Migrating database: adding channel to ${dbPath}`, "migration");
      db.exec("ALTER TABLE sessions ADD COLUMN channel TEXT");
      changesMade = true;
      logger.info("✓ Added channel column", "migration");
    }

    // Create index if we added parent_session_id
    if (!hasParentSessionId) {
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id)",
      );
      logger.info("✓ Created parent session index", "migration");
    }

    if (changesMade) {
      logger.info(`Migration complete for: ${dbPath}`, "migration");
    } else {
      logger.debug(`No migration needed for: ${dbPath}`, "migration");
    }
  } catch (err) {
    logger.error(
      `Migration failed for ${dbPath}: ${err instanceof Error ? err.message : String(err)}`,
      "migration",
    );
    throw err;
  } finally {
    db.close();
  }
}

/**
 * Migrate all workspace session databases.
 * @param workspaces Array of workspace objects with rootPath property
 */
export function migrateAllWorkspaces(workspaces: Array<{ rootPath: string }>): void {
  logger.info(`Running migrations for ${workspaces.length} workspace(s)`, "migration");

  let successCount = 0;
  let errorCount = 0;

  for (const workspace of workspaces) {
    const dbPath = `${workspace.rootPath}/.cortask/sessions.db`;
    try {
      migrateSessionDatabase(dbPath);
      successCount++;
    } catch (err) {
      errorCount++;
      logger.error(
        `Failed to migrate workspace ${workspace.rootPath}: ${err instanceof Error ? err.message : String(err)}`,
        "migration",
      );
    }
  }

  logger.info(
    `Migration summary: ${successCount} successful, ${errorCount} failed`,
    "migration",
  );

  if (errorCount > 0) {
    throw new Error(`Migration failed for ${errorCount} workspace(s)`);
  }
}
