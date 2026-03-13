import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}

interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
  salt: string;
}

interface StoreFile {
  version: 1;
  entries: Record<string, EncryptedData>;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(secret, salt, 32);
}

function encrypt(text: string, secret: string): EncryptedData {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(secret, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
    tag: tag.toString("hex"),
    salt: salt.toString("hex"),
  };
}

function decrypt(enc: EncryptedData, secret: string): string {
  const salt = Buffer.from(enc.salt, "hex");
  const key = deriveKey(secret, salt);
  const iv = Buffer.from(enc.iv, "hex");
  const tag = Buffer.from(enc.tag, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

export class EncryptedCredentialStore implements CredentialStore {
  private filePath: string;
  private secret: string;
  private store: StoreFile | null = null;

  constructor(filePath: string, secret: string) {
    this.filePath = filePath;
    this.secret = secret;
  }

  private async load(): Promise<StoreFile> {
    if (this.store) return this.store;
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.store = JSON.parse(raw) as StoreFile;
    } catch {
      this.store = { version: 1, entries: {} };
    }
    return this.store;
  }

  private async save(): Promise<void> {
    if (!this.store) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.store, null, 2), "utf-8");
    await fs.rename(tmp, this.filePath);
  }

  async get(key: string): Promise<string | null> {
    const store = await this.load();
    const entry = store.entries[key];
    if (!entry) return null;
    try {
      return decrypt(entry, this.secret);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const store = await this.load();
    store.entries[key] = encrypt(value, this.secret);
    await this.save();
  }

  async delete(key: string): Promise<void> {
    const store = await this.load();
    delete store.entries[key];
    await this.save();
  }

  async has(key: string): Promise<boolean> {
    const store = await this.load();
    return key in store.entries;
  }

  async list(): Promise<string[]> {
    const store = await this.load();
    return Object.keys(store.entries);
  }
}

export async function getOrCreateSecret(dataDir: string): Promise<string> {
  const secretFromEnv = process.env.CORTASK_SECRET;
  if (secretFromEnv) return secretFromEnv;

  const keyPath = path.join(dataDir, "master.key");
  try {
    return await fs.readFile(keyPath, "utf-8");
  } catch {
    const key = crypto.randomBytes(32).toString("hex");
    await fs.mkdir(path.dirname(keyPath), { recursive: true });
    await fs.writeFile(keyPath, key, { mode: 0o600 });
    return key;
  }
}

export function credentialKey(
  category: string,
  ...parts: string[]
): string {
  return [category, ...parts].join(".");
}
