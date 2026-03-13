import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { clearSkillCache } from "./loader.js";
import { logger } from "../logging/logger.js";

/**
 * Install a skill from a git URL into the user skills directory.
 */
export async function installSkillFromGit(
  gitUrl: string,
  skillsDir: string,
): Promise<{ name: string; path: string }> {
  await fs.mkdir(skillsDir, { recursive: true });

  // Extract repo name from URL
  const repoName = gitUrl
    .split("/")
    .pop()
    ?.replace(/\.git$/, "");

  if (!repoName) {
    throw new Error(`Invalid git URL: ${gitUrl}`);
  }

  const targetDir = path.join(skillsDir, repoName);

  // Check if already installed
  try {
    await fs.access(targetDir);
    throw new Error(`Skill "${repoName}" is already installed`);
  } catch (err) {
    if ((err as Error).message.includes("already installed")) throw err;
    // Directory doesn't exist — good
  }

  // Clone the repo
  await execAsync(`git clone --depth 1 "${gitUrl}" "${targetDir}"`);

  // Verify SKILL.md exists
  try {
    await fs.access(path.join(targetDir, "SKILL.md"));
  } catch {
    // Clean up
    await fs.rm(targetDir, { recursive: true, force: true });
    throw new Error(
      `Invalid skill: no SKILL.md found in ${repoName}`,
    );
  }

  // Write .origin marker
  await fs.writeFile(
    path.join(targetDir, ".origin"),
    gitUrl,
    "utf-8",
  );

  // Remove .git directory to save space
  try {
    await fs.rm(path.join(targetDir, ".git"), {
      recursive: true,
      force: true,
    });
  } catch {
    // Non-critical
  }

  clearSkillCache();
  logger.info(`Installed skill "${repoName}" from ${gitUrl}`, "skills");

  return { name: repoName, path: targetDir };
}

/**
 * Remove an installed skill.
 */
export async function removeSkill(
  skillName: string,
  skillsDir: string,
): Promise<void> {
  const targetDir = path.join(skillsDir, skillName);

  try {
    await fs.access(targetDir);
  } catch {
    throw new Error(`Skill "${skillName}" not found`);
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  clearSkillCache();
  logger.info(`Removed skill "${skillName}"`, "skills");
}

function execAsync(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}
