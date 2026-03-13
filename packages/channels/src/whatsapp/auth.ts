import fs from "node:fs";
import path from "node:path";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import QRCode from "qrcode";

export async function createAuthState(authDir: string) {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  return useMultiFileAuthState(authDir);
}

export async function generateQRCode(qrString: string): Promise<string> {
  return QRCode.toDataURL(qrString);
}

export function isAuthenticated(authDir: string): boolean {
  return fs.existsSync(path.join(authDir, "creds.json"));
}

export function clearAuthState(authDir: string): void {
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }
}
