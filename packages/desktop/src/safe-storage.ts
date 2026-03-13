import { safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const SAFE_KEY_FILE = "master.key.enc";

export function resolveElectronMasterSecret(dataDir: string): string {
  // Env var takes priority (same as core's resolveMasterSecret)
  const envSecret = process.env.CORTASK_SECRET;
  if (envSecret) return envSecret;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const encPath = path.join(dataDir, SAFE_KEY_FILE);
  const plaintextPath = path.join(dataDir, "master.key");

  // If safeStorage is unavailable, fall back to plaintext file
  if (!safeStorage.isEncryptionAvailable()) {
    return resolvePlaintextFallback(dataDir, plaintextPath);
  }

  // Try reading safeStorage-encrypted key
  if (fs.existsSync(encPath)) {
    try {
      const encrypted = fs.readFileSync(encPath);
      return safeStorage.decryptString(encrypted);
    } catch {
      // Corrupted — will regenerate below
    }
  }

  // Migrate existing plaintext key
  if (fs.existsSync(plaintextPath)) {
    try {
      const key = fs.readFileSync(plaintextPath, "utf-8").trim();
      if (key.length > 0) {
        const encrypted = safeStorage.encryptString(key);
        fs.writeFileSync(encPath, encrypted);
        fs.unlinkSync(plaintextPath);
        console.log("[credentials] Migrated master key to OS keychain");
        return key;
      }
    } catch {
      // If plaintext path is a directory or corrupted, remove it
      if (fs.existsSync(plaintextPath)) {
        fs.rmSync(plaintextPath, { recursive: true, force: true });
      }
    }
  }

  // Generate new key
  const generated = crypto.randomBytes(32).toString("hex");
  const encrypted = safeStorage.encryptString(generated);
  fs.writeFileSync(encPath, encrypted);
  console.log("[credentials] Generated master key in OS keychain");
  return generated;
}

function resolvePlaintextFallback(dataDir: string, keyPath: string): string {
  // Clean up if it's a directory
  if (fs.existsSync(keyPath)) {
    const stats = fs.statSync(keyPath);
    if (stats.isDirectory()) {
      fs.rmSync(keyPath, { recursive: true, force: true });
    } else {
      const key = fs.readFileSync(keyPath, "utf-8").trim();
      if (key.length > 0) return key;
    }
  }

  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(keyPath, generated, { mode: 0o600 });
  console.log(`[credentials] Generated master key at ${keyPath}`);
  return generated;
}
