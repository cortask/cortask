export interface ChannelPlugin {
  id: string;
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(
    handler: (msg: InboundMessage) => Promise<string>,
  ): void;
  sendMessage(target: string, text: string): Promise<void>;
  isRunning(): boolean;
}

export interface InboundMessage {
  channelId: string;
  userId: string;
  userName?: string;
  chatId: string;
  text: string;
  messageId?: number;
}

export { TelegramAdapter } from "./telegram/adapter.js";
export type { TelegramConfig } from "./telegram/adapter.js";

export { DiscordAdapter } from "./discord/adapter.js";
export type { DiscordConfig } from "./discord/adapter.js";

export { WhatsAppAdapter } from "./whatsapp/adapter.js";
export type { WhatsAppConfig, QRCodeResult, TrustedContact } from "./whatsapp/types.js";
