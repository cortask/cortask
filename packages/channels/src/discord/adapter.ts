import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";
import type { ChannelPlugin, InboundMessage } from "../index.js";

export interface DiscordConfig {
  botToken: string;
  allowedGuilds?: string[];
  allowedUsers?: string[];
  respondToMentions?: boolean;
  respondToDMs?: boolean;
}

export class DiscordAdapter implements ChannelPlugin {
  id = "discord";
  name = "Discord";

  private client: Client;
  private config: DiscordConfig;
  private running = false;
  private handler: ((msg: InboundMessage) => Promise<string>) | null = null;

  constructor(config: DiscordConfig) {
    this.config = {
      respondToMentions: true,
      respondToDMs: true,
      ...config,
    };
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.client.on("messageCreate", (msg) => this.handleMessage(msg));

    this.client.once("ready", () => {
      console.log(`[discord] Bot ready as ${this.client.user?.tag}`);
    });

    await this.client.login(this.config.botToken);
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.client.destroy();
    console.log("[discord] Bot stopped");
  }

  onMessage(handler: (msg: InboundMessage) => Promise<string>): void {
    this.handler = handler;
  }

  async sendMessage(target: string, text: string): Promise<void> {
    const channel = await this.client.channels.fetch(target);
    if (channel?.isTextBased() && "send" in channel) {
      const chunks = splitMessage(text, 2000);
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async handleMessage(msg: Message): Promise<void> {
    if (!this.handler || msg.author.bot) return;

    const isDM = !msg.guild;
    const isMention = msg.mentions.has(this.client.user!);

    // Check guild allowlist
    if (
      msg.guild &&
      this.config.allowedGuilds?.length &&
      !this.config.allowedGuilds.includes(msg.guild.id)
    ) {
      return;
    }

    // Check user allowlist
    if (
      this.config.allowedUsers?.length &&
      !this.config.allowedUsers.includes(msg.author.id)
    ) {
      return;
    }

    // Only respond to DMs or mentions
    if (isDM && !this.config.respondToDMs) return;
    if (!isDM && !isMention) return;
    if (!isDM && !this.config.respondToMentions) return;

    // Strip bot mention from text
    let text = msg.content;
    if (isMention && this.client.user) {
      text = text.replace(new RegExp(`<@!?${this.client.user.id}>\\s*`), "").trim();
    }
    if (!text) return;

    const inbound: InboundMessage = {
      channelId: this.id,
      userId: msg.author.id,
      userName: msg.author.displayName ?? msg.author.username,
      chatId: msg.channel.id,
      text,
      messageId: Number(msg.id),
    };

    try {
      if ("sendTyping" in msg.channel) await msg.channel.sendTyping();
      const response = await this.handler(inbound);
      const chunks = splitMessage(response, 2000);
      for (const chunk of chunks) {
        await msg.reply(chunk);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred";
      await msg.reply(`Error: ${errMsg}`).catch(() => {});
    }
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt < maxLen / 2) breakAt = remaining.lastIndexOf(" ", maxLen);
    if (breakAt < maxLen / 2) breakAt = maxLen;
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  return chunks;
}
