import path from "node:path";
import os from "node:os";
import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
  Browsers,
} from "@whiskeysockets/baileys";
import type { ChannelPlugin, InboundMessage } from "../index.js";
import type { WhatsAppConfig, QRCodeResult, TrustedContact } from "./types.js";
import { createAuthState, generateQRCode, isAuthenticated, clearAuthState } from "./auth.js";
import { sendMessage } from "./outbound.js";

// Noop logger to suppress baileys' verbose JSON output
const noop = () => {};
const silentLogger = { level: "silent", trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child: () => silentLogger } as any;

const TERMINAL_STATUS_CODES = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.forbidden,
  DisconnectReason.multideviceMismatch,
]);

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 5_000;
const MAX_RECONNECT_DELAY = 300_000;

export class WhatsAppAdapter implements ChannelPlugin {
  id = "whatsapp";
  name = "WhatsApp";

  private socket: WASocket | null = null;
  private config: WhatsAppConfig;
  private running = false;
  private handler: ((msg: InboundMessage) => Promise<string>) | null = null;
  readonly authDir: string;
  private reconnectAttempts = 0;

  constructor(config: WhatsAppConfig = {}) {
    this.config = {
      allowedUsers: [],
      ...config,
    };
    this.authDir = config.authDir || path.join(os.homedir(), ".cortask", "whatsapp-auth");
  }

  onMessage(handler: (msg: InboundMessage) => Promise<string>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (!isAuthenticated(this.authDir)) {
      throw new Error("WhatsApp not authenticated. Scan QR code first.");
    }
    await this.connectSocket();
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.socket) {
      try { await this.socket.logout(); } catch { /* ignore */ }
      this.socket.end(undefined);
      this.socket = null;
    }
    this.running = false;
    console.log("[whatsapp] Bot stopped");
  }

  async sendMessage(target: string, text: string): Promise<void> {
    if (!this.socket) throw new Error("WhatsApp socket not connected");
    await sendMessage(this.socket, target, text);
  }

  isRunning(): boolean {
    return this.running;
  }

  isAuthenticated(): boolean {
    return isAuthenticated(this.authDir);
  }

  async generateQR(): Promise<QRCodeResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const { state, saveCreds } = await createAuthState(this.authDir);
        const { version } = await fetchLatestBaileysVersion();

        const socket = makeWASocket({
          auth: state,
          version,
          browser: Browsers.ubuntu("Cortask"),
          printQRInTerminal: false,
        });

        let qrGenerated = false;

        socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
          const { connection, qr } = update;

          if (qr && !qrGenerated) {
            qrGenerated = true;
            const qrDataUrl = await generateQRCode(qr);
            resolve({
              qrDataUrl,
              success: true,
              message: "Scan this QR code with WhatsApp",
            });
          }

          if (connection === "open") {
            console.log("[whatsapp] Successfully authenticated");
            socket.end(undefined);
          }

          if (connection === "close") {
            if (!qrGenerated) {
              reject(new Error("Failed to generate QR code"));
            }
            socket.end(undefined);
          }
        });

        socket.ev.on("creds.update", saveCreds);

        setTimeout(() => {
          if (!qrGenerated) {
            socket.end(undefined);
            reject(new Error("QR code generation timeout"));
          }
        }, 60_000);
      } catch (err) {
        reject(err);
      }
    });
  }

  async logout(): Promise<void> {
    if (this.socket) {
      try { await this.socket.logout(); this.socket.end(undefined); } catch { /* ignore */ }
      this.socket = null;
    }
    clearAuthState(this.authDir);
    this.running = false;
    console.log("[whatsapp] Logged out");
  }

  setTrustedContacts(contacts: TrustedContact[]): void {
    this.config.trustedContacts = contacts;
  }

  private findTrustedContact(userId: string): TrustedContact | undefined {
    if (!this.config.trustedContacts?.length) return undefined;
    return this.config.trustedContacts.find((c) => {
      const normalized = c.phone.replace(/[\s+\-()]/g, "");
      return userId === normalized || userId.endsWith(normalized) || normalized.endsWith(userId);
    });
  }

  private async connectSocket(): Promise<void> {
    const { state, saveCreds } = await createAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      auth: state,
      version,
      browser: Browsers.ubuntu("Cortask"),
      printQRInTerminal: false,
    });

    this.socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode as number | undefined;

        if (statusCode != null && TERMINAL_STATUS_CODES.has(statusCode)) {
          console.error(`[whatsapp] Session terminated (status ${statusCode}). Re-authenticate.`);
          this.running = false;
          return;
        }

        this.reconnectAttempts++;
        if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.error(`[whatsapp] Giving up after ${this.reconnectAttempts} attempts.`);
          this.running = false;
          return;
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
          MAX_RECONNECT_DELAY,
        );
        console.log(`[whatsapp] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

        setTimeout(() => {
          if (this.running) this.connectSocket();
        }, delay);
      } else if (connection === "open") {
        this.reconnectAttempts = 0;
        console.log("[whatsapp] Connected");
      }
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.key?.remoteJid || msg.key.remoteJid === "status@broadcast" || msg.key.fromMe) continue;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        if (!text) continue;

        const remoteJid = msg.key.remoteJid;
        const participantJid = msg.key.participant || remoteJid;
        const userId = participantJid.replace("@s.whatsapp.net", "").replace(":@lid", "").replace("@lid", "");

        // Check trusted contacts (takes priority over legacy allowedUsers)
        if (this.config.trustedContacts?.length) {
          const contact = this.findTrustedContact(userId);
          if (!contact) continue; // silently ignore unknown numbers
          if (contact.permission === "read") {
            await sendMessage(this.socket!, remoteJid, "You have read-only access.");
            continue;
          }
          // "write" and "admin" proceed to handler
        } else if (this.config.allowedUsers?.length) {
          // Legacy allowedUsers fallback
          const phone = `+${userId}`;
          const allowed = this.config.allowedUsers.some((u) => {
            const normalized = u.replace(/[\s+]/g, "");
            return u === phone || u === userId || userId.includes(normalized);
          });
          if (!allowed) continue;
        }

        if (!this.handler) continue;

        await this.socket!.sendPresenceUpdate("composing", remoteJid);

        try {
          const inbound: InboundMessage = {
            channelId: "whatsapp",
            userId,
            userName: msg.pushName || "Unknown",
            chatId: remoteJid,
            text,
          };

          const response = await this.handler(inbound);
          if (response) await sendMessage(this.socket!, remoteJid, response);
        } catch (err) {
          console.error("[whatsapp] Error handling message:", err);
          await sendMessage(this.socket!, remoteJid, "Sorry, an error occurred.");
        } finally {
          await this.socket!.sendPresenceUpdate("paused", remoteJid);
        }
      }
    });
  }
}
