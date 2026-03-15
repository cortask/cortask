import fs from "node:fs/promises";
import path from "node:path";
import { clearSkillCache } from "./loader.js";

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate a skill name (kebab-case, 2-50 chars).
 */
export function validateSkillName(name: string): string | null {
  if (!name || name.length < 2 || name.length > 50) {
    return "Skill name must be 2-50 characters";
  }
  if (!SKILL_NAME_RE.test(name)) {
    return "Skill name must be kebab-case (lowercase letters, numbers, hyphens)";
  }
  return null;
}

/**
 * Create a new custom skill by writing a SKILL.md file.
 */
export async function createSkill(
  skillsDir: string,
  name: string,
  rawContent: string,
): Promise<{ name: string; path: string }> {
  const nameErr = validateSkillName(name);
  if (nameErr) throw new Error(nameErr);

  const skillDir = path.join(skillsDir, name);

  // Check if directory already exists
  try {
    await fs.access(skillDir);
    throw new Error(`Skill "${name}" already exists`);
  } catch (err) {
    if ((err as Error).message.includes("already exists")) throw err;
    // Directory doesn't exist — good
  }

  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), rawContent, "utf-8");

  clearSkillCache();
  return { name, path: skillDir };
}

/**
 * Update an existing custom skill's SKILL.md file.
 */
export async function updateSkill(
  skillsDir: string,
  name: string,
  rawContent: string,
): Promise<void> {
  const skillDir = path.join(skillsDir, name);
  const skillMdPath = path.join(skillDir, "SKILL.md");

  try {
    await fs.access(skillMdPath);
  } catch {
    throw new Error(`Skill "${name}" not found`);
  }

  await fs.writeFile(skillMdPath, rawContent, "utf-8");
  clearSkillCache();
}

/**
 * Read the raw SKILL.md content for editing.
 */
export async function readSkillFile(
  skillsDir: string,
  name: string,
): Promise<string> {
  const skillMdPath = path.join(skillsDir, name, "SKILL.md");

  try {
    return await fs.readFile(skillMdPath, "utf-8");
  } catch {
    throw new Error(`Skill "${name}" not found`);
  }
}
