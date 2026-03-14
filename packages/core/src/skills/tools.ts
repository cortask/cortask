import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "../providers/types.js";
import type {
  SkillEntry,
  SkillToolTemplate,
  SkillCodeTool,
} from "./types.js";
import {
  getCredentialStorageKey,
  getOAuth2StorageKeys,
  getInstanceRegistryKey,
  getInstanceStorageKey,
} from "./credential-schema.js";
import type { CredentialStore } from "../credentials/store.js";
import { logger } from "../logging/logger.js";

interface SkillToolRegistry {
  toolDefs: ToolDefinition[];
  toolNames: Set<string>;
  handlers: Map<
    string,
    (args: Record<string, unknown>, workspacePath: string) => Promise<ToolResult>
  >;
}

/**
 * Build tool definitions and handlers from eligible skills.
 */
export async function buildSkillTools(
  skills: SkillEntry[],
  credentialStore: CredentialStore | null,
): Promise<SkillToolRegistry> {
  const toolDefs: ToolDefinition[] = [];
  const toolNames = new Set<string>();
  const handlers = new Map<
    string,
    (args: Record<string, unknown>, workspacePath: string) => Promise<ToolResult>
  >();

  for (const skill of skills) {
    // HTTP template tools
    if (skill.manifest.tools) {
      for (const template of skill.manifest.tools) {
        const def = buildHttpToolDefinition(template);
        toolDefs.push(def);
        toolNames.add(def.name);

        handlers.set(def.name, async (args, workspacePath) => {
          return executeHttpTool(
            template,
            args,
            skill,
            credentialStore,
            workspacePath,
          );
        });
      }
    }

    // Code tools (index.js)
    if (skill.hasCodeTools) {
      try {
        const indexPath = `file://${skill.path}/index.js`;
        const mod = await import(indexPath);
        const codeTools = (mod.tools ?? []) as SkillCodeTool[];

        for (const ct of codeTools) {
          toolDefs.push({
            name: ct.name,
            description: ct.description,
            inputSchema: ct.inputSchema,
          });
          toolNames.add(ct.name);

          handlers.set(ct.name, async (args, _workspacePath) => {
            try {
              const result = await ct.execute(args, {
                credentialStore,
                skillName: skill.manifest.name,
              });
              return {
                toolCallId: "",
                content: result.content,
                isError: result.isError,
              };
            } catch (err) {
              return {
                toolCallId: "",
                content: `Code tool error: ${err instanceof Error ? err.message : String(err)}`,
                isError: true,
              };
            }
          });
        }
      } catch (err) {
        logger.error(
          `Failed to load code tools for skill ${skill.manifest.name}: ${err}`,
          "skills",
        );
      }
    }
  }

  return { toolDefs, toolNames, handlers };
}

/**
 * Build a ToolDefinition from an HTTP template.
 */
function buildHttpToolDefinition(
  template: SkillToolTemplate,
): ToolDefinition {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, input] of Object.entries(template.input)) {
    properties[key] = {
      type: input.type,
      description: input.description,
    };
    if (input.enum) {
      (properties[key] as Record<string, unknown>).enum = input.enum;
    }
    if (input.required !== false) {
      required.push(key);
    }
  }

  return {
    name: template.name,
    description: template.description,
    inputSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

/**
 * Execute an HTTP template tool call.
 *
 * Supports three placeholder types in URL, headers, body:
 * - {{argName}} → from tool call arguments
 * - {{credential:fieldKey}} → from credential store
 * - {{oauth2:accessToken}} → from OAuth2 tokens
 */
async function executeHttpTool(
  template: SkillToolTemplate,
  args: Record<string, unknown>,
  skill: SkillEntry,
  credentialStore: CredentialStore | null,
  workspacePath: string,
): Promise<ToolResult> {
  try {
    // Build credential values map
    const credValues = await resolveCredentials(skill, credentialStore);

    // Resolve URL
    const url = resolvePlaceholders(
      template.request.url,
      args,
      credValues,
    );

    // Resolve method
    const method = template.request.method
      ? resolvePlaceholders(template.request.method, args, credValues)
      : "GET";

    // Resolve headers
    const headers: Record<string, string> = {};
    if (template.request.headers) {
      for (const [key, value] of Object.entries(template.request.headers)) {
        headers[key] = resolvePlaceholders(value, args, credValues);
      }
    }
    if (!headers["Content-Type"] && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    // Resolve body
    let body: string | undefined;
    if (template.request.body) {
      body = resolvePlaceholders(template.request.body, args, credValues);
    }

    logger.debug(
      `Skill HTTP: ${method} ${url.slice(0, 100)}`,
      "skills",
    );

    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
      signal: AbortSignal.timeout(60_000),
    });

    const content = await response.text();

    if (!response.ok) {
      return {
        toolCallId: "",
        content: `HTTP ${response.status} ${response.statusText}: ${content.slice(0, 2000)}`,
        isError: true,
      };
    }

    // Save response to _temp/ and return metadata so the agent can
    // use data_file to query, artifact to display, or write_file to transform
    const tempDir = path.join(workspacePath, "_temp");
    await fs.mkdir(tempDir, { recursive: true });

    const isJson = looksLikeJson(content);
    const ext = isJson ? "json" : "txt";
    const filename = `${template.name}_${Date.now()}.${ext}`;
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, "utf-8");

    const summary = buildResponseSummary(content, isJson);

    return {
      toolCallId: "",
      content: [
        `Data saved to: _temp/${filename}`,
        `Size: ${formatBytes(content.length)}`,
        summary,
        "",
        "Use data_file to inspect or query this data, or artifact to display it.",
      ].join("\n"),
    };
  } catch (err) {
    return {
      toolCallId: "",
      content: `HTTP tool error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    };
  }
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildResponseSummary(content: string, isJson: boolean): string {
  if (!isJson) {
    const lines = content.split("\n");
    return `Lines: ${lines.length}\nPreview:\n${lines.slice(0, 5).join("\n")}`;
  }

  try {
    const parsed = JSON.parse(content);

    // Array of objects — most common API response
    if (Array.isArray(parsed)) {
      const count = parsed.length;
      const sample = parsed[0];
      const columns = sample && typeof sample === "object"
        ? Object.keys(sample)
        : [];
      return [
        `Format: JSON array (${count} items)`,
        columns.length > 0 ? `Columns: ${columns.join(", ")}` : "",
        count > 0 ? `Sample: ${JSON.stringify(parsed[0]).slice(0, 300)}` : "",
      ].filter(Boolean).join("\n");
    }

    // Object with a data/results array inside
    if (typeof parsed === "object" && parsed !== null) {
      const keys = Object.keys(parsed);
      // Find the first array property (likely the data payload)
      const arrayKey = keys.find((k) => Array.isArray(parsed[k]));
      if (arrayKey) {
        const arr = parsed[arrayKey] as unknown[];
        const sample = arr[0];
        const columns = sample && typeof sample === "object" && sample !== null
          ? Object.keys(sample)
          : [];
        return [
          `Format: JSON object with ${keys.length} keys: ${keys.join(", ")}`,
          `Data in "${arrayKey}": ${arr.length} items`,
          columns.length > 0 ? `Columns: ${columns.join(", ")}` : "",
          arr.length > 0 ? `Sample: ${JSON.stringify(arr[0]).slice(0, 300)}` : "",
        ].filter(Boolean).join("\n");
      }

      return `Format: JSON object with ${keys.length} keys: ${keys.join(", ")}`;
    }

    return `Format: JSON (${typeof parsed})`;
  } catch {
    return "Format: text (invalid JSON)";
  }
}

/**
 * Resolve all credential values for a skill into a flat map.
 */
async function resolveCredentials(
  skill: SkillEntry,
  credentialStore: CredentialStore | null,
): Promise<Map<string, string>> {
  const values = new Map<string, string>();

  if (!skill.credentialSchema || !credentialStore) return values;

  for (const cred of skill.credentialSchema.credentials) {
    if (cred.type === "oauth2") {
      const keys = getOAuth2StorageKeys(skill.manifest.name, cred.id);
      const accessToken = await credentialStore.get(keys.accessToken);
      if (accessToken) {
        values.set("oauth2:accessToken", accessToken);
      }
      const refreshToken = await credentialStore.get(keys.refreshToken);
      if (refreshToken) {
        values.set("oauth2:refreshToken", refreshToken);
      }
    } else if (cred.multiple && cred.fields) {
      // Multi-instance: resolve from first available instance
      const registryKey = getInstanceRegistryKey(skill.manifest.name, cred.id, cred.storeAs);
      const raw = await credentialStore.get(registryKey);
      const instances = raw ? JSON.parse(raw) as Array<{ id: string }> : [];
      if (instances.length > 0) {
        for (const field of cred.fields) {
          const key = getInstanceStorageKey(
            skill.manifest.name,
            cred.id,
            instances[0].id,
            field.key,
            cred.storeAs,
          );
          const value = await credentialStore.get(key);
          if (value) {
            values.set(`credential:${field.key}`, value);
          }
        }
      }
    } else if (cred.fields) {
      for (const field of cred.fields) {
        const key = getCredentialStorageKey(
          skill.manifest.name,
          cred.id,
          field.key,
          cred.storeAs,
        );
        const value = await credentialStore.get(key);
        if (value) {
          values.set(`credential:${field.key}`, value);
        }
      }
    }
  }

  return values;
}

/**
 * Replace {{placeholder}} patterns in a string.
 *
 * Priority:
 * 1. {{credential:fieldKey}} → from credential map
 * 2. {{oauth2:tokenField}} → from credential map
 * 3. {{argName}} → from tool call arguments
 */
function resolvePlaceholders(
  template: string,
  args: Record<string, unknown>,
  credValues: Map<string, string>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    // Credential placeholder
    if (key.startsWith("credential:") || key.startsWith("oauth2:")) {
      const value = credValues.get(key);
      if (value) return value;
      return match; // Leave unresolved
    }

    // Argument placeholder
    const argValue = args[key];
    if (argValue !== undefined) {
      return typeof argValue === "string"
        ? argValue
        : JSON.stringify(argValue);
    }

    return match;
  });
}
