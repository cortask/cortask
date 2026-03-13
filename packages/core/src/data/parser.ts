import fs from "node:fs";
import path from "node:path";

export interface TabularData {
  headers: string[];
  rows: string[][];
}

const MAX_RAW_SIZE = 500_000; // 500KB for CSV/JSON
const MAX_ROWS = 50_000;

/**
 * Parse a data file into tabular form.
 * Supports CSV, JSON (array of objects), and XLSX.
 */
export async function parseDataFile(filePath: string): Promise<TabularData> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".csv":
    case ".tsv":
      return parseCsv(filePath, ext === ".tsv" ? "\t" : undefined);
    case ".json":
      return parseJson(filePath);
    case ".xlsx":
      return parseXlsx(filePath);
    default:
      throw new Error(
        `Unsupported file type: ${ext}. Supported: .csv, .tsv, .json, .xlsx`,
      );
  }
}

/**
 * Detect column types by sampling the first 100 non-empty values per column.
 */
export function detectColumnTypes(
  data: TabularData,
): Array<"INTEGER" | "REAL" | "TEXT"> {
  return data.headers.map((_, colIdx) => {
    const sample = data.rows
      .slice(0, 100)
      .map((r) => r[colIdx] ?? "")
      .filter((v) => v !== "");

    if (sample.length === 0) return "TEXT";
    if (sample.every((v) => /^-?\d+$/.test(v))) return "INTEGER";
    if (sample.every((v) => /^-?\d+[.,]?\d*$/.test(v.replace(",", "."))))
      return "REAL";
    return "TEXT";
  });
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCsv(filePath: string, forceDelimiter?: string): TabularData {
  let raw = fs.readFileSync(filePath, "utf-8");
  if (raw.length > MAX_RAW_SIZE) {
    raw = raw.slice(0, MAX_RAW_SIZE);
    // Trim to last complete line
    const lastNewline = raw.lastIndexOf("\n");
    if (lastNewline > 0) raw = raw.slice(0, lastNewline);
  }

  // Strip BOM
  if (raw.startsWith("\ufeff")) raw = raw.slice(1);
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Auto-detect delimiter from first line
  const firstLine = raw.split("\n")[0] ?? "";
  let delimiter = forceDelimiter ?? ",";
  if (!forceDelimiter) {
    const tabs = (firstLine.match(/\t/g) ?? []).length;
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    if (tabs > commas && tabs > semicolons) delimiter = "\t";
    else if (semicolons > commas) delimiter = ";";
  }

  const lines = splitCsvLines(raw, delimiter);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0];
  const rows = lines.slice(1, MAX_ROWS + 1);
  return { headers, rows };
}

function splitCsvLines(text: string, delimiter: string): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        current.push(field.trim());
        field = "";
      } else if (ch === "\n") {
        current.push(field.trim());
        if (current.length > 1 || current[0] !== "") {
          result.push(current);
        }
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }

  // Last field
  current.push(field.trim());
  if (current.length > 1 || current[0] !== "") {
    result.push(current);
  }

  return result;
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

function parseJson(filePath: string): TabularData {
  let raw = fs.readFileSync(filePath, "utf-8");
  if (raw.length > MAX_RAW_SIZE) {
    throw new Error(
      `JSON file too large (${(raw.length / 1024).toFixed(0)}KB, max ${MAX_RAW_SIZE / 1024}KB). ` +
        "Consider converting to CSV first.",
    );
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "JSON file must contain an array of objects at the top level.",
    );
  }

  if (parsed.length === 0) return { headers: [], rows: [] };

  // Collect all keys from all objects for headers
  const keySet = new Set<string>();
  for (const obj of parsed.slice(0, 1000)) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const key of Object.keys(obj)) keySet.add(key);
    }
  }
  const headers = Array.from(keySet);

  const rows: string[][] = [];
  for (const obj of parsed.slice(0, MAX_ROWS)) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      rows.push(
        headers.map((h) => {
          const val = obj[h];
          if (val === null || val === undefined) return "";
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        }),
      );
    }
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// XLSX parser
// ---------------------------------------------------------------------------

async function parseXlsx(filePath: string): Promise<TabularData> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return { headers: [], rows: [] };
  }

  const headers: string[] = [];
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    while (headers.length < colNumber - 1) headers.push("");
    headers.push(String(cell.value ?? ""));
  });

  const rows: string[][] = [];
  const maxRow = Math.min(worksheet.rowCount, MAX_ROWS + 1);

  for (let rowNum = 2; rowNum <= maxRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values: string[] = [];
    let hasValue = false;

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const cell = row.getCell(colIdx + 1);
      const val = cell.value;
      if (val !== null && val !== undefined) hasValue = true;

      if (val === null || val === undefined) {
        values.push("");
      } else if (val instanceof Date) {
        values.push(val.toISOString());
      } else if (typeof val === "object") {
        // Handle rich text, formula results, etc.
        const result = (val as { result?: unknown }).result;
        const text = (val as { text?: unknown }).text;
        values.push(String(result ?? text ?? JSON.stringify(val)));
      } else {
        values.push(String(val));
      }
    }

    if (hasValue) rows.push(values);
  }

  return { headers, rows };
}
