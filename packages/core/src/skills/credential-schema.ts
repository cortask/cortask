import fs from "node:fs/promises";
import path from "node:path";
import type { CredentialSchema, CredentialInstance } from "./types.js";

/**
 * Load credential schema from a skill's credentials.json file.
 */
export async function loadCredentialSchema(
  skillDir: string,
): Promise<CredentialSchema | undefined> {
  const schemaPath = path.join(skillDir, "credentials.json");
  try {
    const raw = await fs.readFile(schemaPath, "utf-8");
    const parsed = JSON.parse(raw) as CredentialSchema;

    if (
      !parsed.credentials ||
      !Array.isArray(parsed.credentials)
    ) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Get the credential store key for a skill credential field.
 * Format: skill.{skillName}.{credentialId}.{fieldKey}
 */
export function getCredentialStorageKey(
  skillName: string,
  credentialId: string,
  fieldKey: string,
  storeAs?: string,
): string {
  if (storeAs) {
    return `${storeAs}.${fieldKey}`;
  }
  return `skill.${skillName}.${credentialId}.${fieldKey}`;
}

/**
 * Get the credential store key for a multi-instance credential field.
 * Format: skill.{skillName}.{credentialId}.{instanceId}.{fieldKey}
 */
export function getInstanceStorageKey(
  skillName: string,
  credentialId: string,
  instanceId: string,
  fieldKey: string,
  storeAs?: string,
): string {
  if (storeAs) {
    return `${storeAs}.${instanceId}.${fieldKey}`;
  }
  return `skill.${skillName}.${credentialId}.${instanceId}.${fieldKey}`;
}

/**
 * Get the registry key that stores the list of instances for a multi-instance credential.
 * Value is a JSON array of CredentialInstance objects.
 */
export function getInstanceRegistryKey(
  skillName: string,
  credentialId: string,
  storeAs?: string,
): string {
  if (storeAs) {
    return `${storeAs}._instances`;
  }
  return `skill.${skillName}.${credentialId}._instances`;
}

/**
 * Slugify a label into a valid instance ID.
 */
export function slugifyInstanceLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get OAuth2 storage keys for a skill credential.
 */
export function getOAuth2StorageKeys(
  skillName: string,
  credentialId: string,
): {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
} {
  const prefix = `skill.${skillName}.${credentialId}.oauth2`;
  return {
    accessToken: `${prefix}.accessToken`,
    refreshToken: `${prefix}.refreshToken`,
    expiresAt: `${prefix}.expiresAt`,
  };
}
