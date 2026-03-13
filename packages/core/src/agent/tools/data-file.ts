import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import type { ToolHandler, ToolExecutionContext } from "../types.js";
import type { ToolResult } from "../../providers/types.js";
import {
  parseDataFile,
  detectColumnTypes,
  type TabularData,
} from "../../data/parser.js";

const MAX_QUERY_ROWS = 100;

export const dataFileTool: ToolHandler = {
  definition: {
    name: "data_file",
    description:
      "Inspect and query data files (CSV, TSV, JSON, XLSX) without loading them into the conversation. " +
      "Use 'inspect' to see column names, types, row count, and sample rows. " +
      "Use 'query' to run SQL queries (table is named 'data') for aggregations, filtering, and analysis. " +
      "For showing files to the user, use the show_file tool instead.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["inspect", "query"],
          description: "The action to perform",
        },
        path: {
          type: "string",
          description:
            "Path to the data file (relative to workspace or absolute)",
        },
        sql: {
          type: "string",
          description:
            'SQL query to run against the data (action=query only). The table is named "data". Example: SELECT column, COUNT(*) FROM data GROUP BY column',
        },
      },
      required: ["action", "path"],
    },
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolResult> {
    const action = args.action as string;
    const rawPath = args.path as string;

    if (!action || !rawPath) {
      return {
        toolCallId: "",
        content: "action and path are required",
        isError: true,
      };
    }

    // Resolve path relative to workspace
    const filePath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(context.workspacePath, rawPath);

    // Security: validate path is within workspace
    if (!filePath.startsWith(context.workspacePath)) {
      return {
        toolCallId: "",
        content: "Error: Cannot access files outside the workspace",
        isError: true,
      };
    }

    if (!fs.existsSync(filePath)) {
      return {
        toolCallId: "",
        content: `File not found: ${rawPath}`,
        isError: true,
      };
    }

    try {
      switch (action) {
        case "inspect":
          return await handleInspect(filePath);
        case "query":
          return await handleQuery(filePath, args.sql as string);
        default:
          return {
            toolCallId: "",
            content: `Unknown action: ${action}. Use "inspect" or "query".`,
            isError: true,
          };
      }
    } catch (err) {
      return {
        toolCallId: "",
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// inspect
// ---------------------------------------------------------------------------

async function handleInspect(filePath: string): Promise<ToolResult> {
  const data = await parseDataFile(filePath);
  const types = detectColumnTypes(data);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);

  const lines: string[] = [];
  lines.push(`File: ${fileName} (${ext.toUpperCase()})`);
  lines.push(`Rows: ${data.rows.length}`);
  lines.push(`Columns: ${data.headers.length}`);
  lines.push("");

  // Column info — show quoted SQL names so the agent knows exactly how to reference them
  lines.push("Columns (use these quoted names in SQL):");
  for (let i = 0; i < data.headers.length; i++) {
    lines.push(`  "${data.headers[i]}" (${types[i]})`);
  }

  // Sample rows
  if (data.rows.length > 0) {
    lines.push("");
    lines.push("Sample rows (first 3):");
    const sampleRows = data.rows.slice(0, 3);
    for (const row of sampleRows) {
      const pairs = data.headers
        .map((h, i) => {
          const val = row[i] ?? "";
          return `${h}: ${val.length > 80 ? val.slice(0, 80) + "…" : val}`;
        })
        .join(" | ");
      lines.push(`  ${pairs}`);
    }
  }

  return { toolCallId: "", content: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

async function handleQuery(
  filePath: string,
  sql: string | undefined,
): Promise<ToolResult> {
  if (!sql) {
    return {
      toolCallId: "",
      content:
        'The "sql" parameter is required for query action. Example: SELECT COUNT(*) FROM data',
      isError: true,
    };
  }

  const data = await parseDataFile(filePath);

  if (data.headers.length === 0) {
    return { toolCallId: "", content: "File has no columns.", isError: true };
  }

  const db = new Database(":memory:");

  try {
    createTable(db, data);
    insertRows(db, data);

    const stmt = db.prepare(sql);

    // Detect if query returns rows (SELECT) or is a command
    if (stmt.reader) {
      const rows = stmt.all() as Record<string, unknown>[];
      return {
        toolCallId: "",
        content: formatQueryResults(rows),
      };
    } else {
      const info = stmt.run();
      return {
        toolCallId: "",
        content: `Statement executed. Changes: ${info.changes}`,
      };
    }
  } finally {
    db.close();
  }
}

function escapeIdent(name: string): string {
  // Escape double quotes inside the name, then wrap in double quotes
  return `"${name.replace(/"/g, '""')}"`;
}

function createTable(db: Database.Database, data: TabularData): void {
  const types = detectColumnTypes(data);
  const columns = data.headers
    .map((h, i) => `${escapeIdent(h)} ${types[i]}`)
    .join(", ");

  db.exec(`CREATE TABLE data (${columns})`);
}

function insertRows(db: Database.Database, data: TabularData): void {
  const types = detectColumnTypes(data);
  const placeholders = data.headers.map(() => "?").join(", ");
  const insert = db.prepare(`INSERT INTO data VALUES (${placeholders})`);

  const insertMany = db.transaction((rows: string[][]) => {
    for (const row of rows) {
      const values = row.map((val, i) => {
        if (val === "") return null;
        if (types[i] === "INTEGER") {
          const n = parseInt(val, 10);
          return isNaN(n) ? val : n;
        }
        if (types[i] === "REAL") {
          const n = parseFloat(val.replace(",", "."));
          return isNaN(n) ? val : n;
        }
        return val;
      });
      insert.run(...values);
    }
  });

  insertMany(data.rows);
}

function formatQueryResults(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "No results.";

  const limited = rows.slice(0, MAX_QUERY_ROWS);
  const keys = Object.keys(limited[0]);

  // Format as aligned text table
  const colWidths = keys.map((k) => {
    const maxVal = limited.reduce((max, row) => {
      const val = String(row[k] ?? "");
      return Math.max(max, val.length);
    }, k.length);
    return Math.min(maxVal, 40); // Cap column width
  });

  const header = keys
    .map((k, i) => k.padEnd(colWidths[i]))
    .join(" | ");
  const separator = colWidths.map((w) => "-".repeat(w)).join("-+-");
  const body = limited.map((row) =>
    keys
      .map((k, i) => {
        const val = String(row[k] ?? "");
        return (val.length > 40 ? val.slice(0, 37) + "…" : val).padEnd(
          colWidths[i],
        );
      })
      .join(" | "),
  );

  const lines = [header, separator, ...body];

  if (rows.length > MAX_QUERY_ROWS) {
    lines.push(`\n... (${rows.length - MAX_QUERY_ROWS} more rows not shown)`);
  }

  lines.push(`\n${rows.length} row(s)`);

  return lines.join("\n");
}
