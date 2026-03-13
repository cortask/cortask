import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type {
  SkillManifest,
  SkillEntry,
  SkillSource,
  SkillInstallOption,
  CredentialSchema,
} from "./types.js";
import { loadCredentialSchema, getCredentialStorageKey, getOAuth2StorageKeys, getInstanceRegistryKey, getInstanceStorageKey } from "./credential-schema.js";
import type { CredentialStore } from "../credentials/store.js";
import { logger } from "../logging/logger.js";

// In-memory cache
let skillCache: SkillEntry[] | null = null;

export function clearSkillCache(): void {
  skillCache = null;
}

/**
 * Load all skills from bundled, user, and config directories.
 */
export async function loadSkills(
  bundledDir: string | null,
  userDir: string | null,
  configDirs: string[],
  credentialStore: CredentialStore | null,
): Promise<SkillEntry[]> {
  if (skillCache) return skillCache;

  const skills: SkillEntry[] = [];

  // Load from bundled skills directory
  if (bundledDir) {
    const entries = await scanSkillDir(bundledDir, "bundled");
    skills.push(...entries);
  }

  // Load from user data directory
  if (userDir) {
    const entries = await scanSkillDir(userDir, "user");
    skills.push(...entries);
  }

  // Load from config-specified directories
  for (const dir of configDirs) {
    const entries = await scanSkillDir(dir, "config-dir");
    skills.push(...entries);
  }

  // Check eligibility and credential status for all skills
  for (const skill of skills) {
    // Load credential schema
    skill.credentialSchema = await loadCredentialSchema(skill.path);

    // Check eligibility
    const result = await checkEligibility(skill, credentialStore);
    skill.eligible = result.eligible;
    skill.ineligibleReason = result.reason;
    skill.credentialStatus = result.credentialStatus;

    // Filter install options by platform
    if (skill.manifest.install) {
      skill.installOptions = skill.manifest.install
        .filter((spec) => {
          if (!spec.os) return true;
          return spec.os.includes(process.platform);
        })
        .map((spec, i) => ({
          id: spec.id ?? `install-${i}`,
          kind: spec.kind,
          label: spec.label ?? `Install via ${spec.kind}`,
        }));
    }
  }

  skillCache = skills;
  return skills;
}

/**
 * Get only eligible skills.
 */
export function getEligibleSkills(skills: SkillEntry[]): SkillEntry[] {
  return skills.filter((s) => s.eligible);
}

/**
 * Scan a directory for skill subdirectories containing SKILL.md.
 */
async function scanSkillDir(
  dir: string,
  source: SkillSource,
): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(dir, entry.name);
      const skillMdPath = path.join(skillDir, "SKILL.md");

      try {
        const raw = await fs.readFile(skillMdPath, "utf-8");
        const parsed = matter(raw);
        const manifest = parsed.data as SkillManifest;

        if (!manifest.name) {
          manifest.name = entry.name;
        }
        if (!manifest.description) {
          manifest.description = "";
        }

        // Detect git-installed skills
        let skillSource = source;
        try {
          await fs.access(path.join(skillDir, ".origin"));
          skillSource = "git";
        } catch {
          // Not a git skill
        }

        // Detect code tools (index.js)
        let hasCodeTools = false;
        try {
          await fs.access(path.join(skillDir, "index.js"));
          hasCodeTools = true;
        } catch {
          // No code tools
        }

        skills.push({
          manifest,
          content: parsed.content.trim(),
          path: skillDir,
          eligible: false, // Will be set by checkEligibility
          source: skillSource,
          editable: skillSource !== "bundled",
          hasCodeTools,
        });
      } catch {
        // No SKILL.md or parse error — skip
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }

  return skills;
}

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  credentialStatus?: Record<string, boolean>;
}

/**
 * Check if a skill is eligible to run on this system.
 */
async function checkEligibility(
  skill: SkillEntry,
  credentialStore: CredentialStore | null,
): Promise<EligibilityResult> {
  const { manifest } = skill;

  // `always: true` bypasses all checks
  if (manifest.always) {
    return { eligible: true };
  }

  // OS check
  const requiredOs = manifest.compatibility?.os;
  if (requiredOs && !requiredOs.includes(process.platform)) {
    return {
      eligible: false,
      reason: `Requires OS: ${requiredOs.join(", ")} (current: ${process.platform})`,
    };
  }

  // Environment variable check
  if (manifest.requires?.env) {
    for (const envVar of manifest.requires.env) {
      if (!process.env[envVar]) {
        return {
          eligible: false,
          reason: `Missing environment variable: ${envVar}`,
        };
      }
    }
  }

  // Binary availability check
  if (manifest.requires?.bins) {
    for (const bin of manifest.requires.bins) {
      if (!(await isBinaryAvailable(bin))) {
        return {
          eligible: false,
          reason: `Missing binary: ${bin}`,
        };
      }
    }
  }

  // Credential check
  if (skill.credentialSchema && credentialStore) {
    const credentialStatus: Record<string, boolean> = {};
    let allFulfilled = true;

    for (const cred of skill.credentialSchema.credentials) {
      if (cred.type === "oauth2") {
        const keys = getOAuth2StorageKeys(manifest.name, cred.id);
        const hasToken = await credentialStore.has(keys.accessToken);
        credentialStatus[cred.id] = hasToken;
        if (!hasToken) allFulfilled = false;
      } else if (cred.multiple && cred.fields) {
        // Multi-instance: eligible if at least one instance has all required fields
        const registryKey = getInstanceRegistryKey(manifest.name, cred.id, cred.storeAs);
        const raw = await credentialStore.get(registryKey);
        const instances = raw ? JSON.parse(raw) as Array<{ id: string }> : [];
        let anyInstanceFulfilled = false;

        for (const instance of instances) {
          let instanceOk = true;
          for (const field of cred.fields) {
            if (field.required === false) continue;
            const key = getInstanceStorageKey(
              manifest.name,
              cred.id,
              instance.id,
              field.key,
              cred.storeAs,
            );
            if (!(await credentialStore.has(key))) {
              instanceOk = false;
              break;
            }
          }
          if (instanceOk) {
            anyInstanceFulfilled = true;
            break;
          }
        }

        credentialStatus[cred.id] = anyInstanceFulfilled;
        if (!anyInstanceFulfilled) allFulfilled = false;
      } else if (cred.fields) {
        let fieldsFulfilled = true;
        for (const field of cred.fields) {
          if (field.required === false) continue;
          const key = getCredentialStorageKey(
            manifest.name,
            cred.id,
            field.key,
            cred.storeAs,
          );
          const exists = await credentialStore.has(key);
          if (!exists) {
            fieldsFulfilled = false;
            break;
          }
        }
        credentialStatus[cred.id] = fieldsFulfilled;
        if (!fieldsFulfilled) allFulfilled = false;
      }
    }

    if (!allFulfilled) {
      return {
        eligible: false,
        reason: "Missing required credentials",
        credentialStatus,
      };
    }

    return { eligible: true, credentialStatus };
  }

  return { eligible: true };
}

/**
 * Check if a binary is available on PATH.
 */
async function isBinaryAvailable(name: string): Promise<boolean> {
  const { exec } = await import("node:child_process");
  const cmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;

  return new Promise((resolve) => {
    exec(cmd, (error) => {
      resolve(!error);
    });
  });
}
