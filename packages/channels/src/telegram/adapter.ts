import { Bot, type Context } from "grammy";
import type { ChannelPlugin, InboundMessage } from "../index.js";

export interface TelegramConfig {
  botToken: string;
  allowedUsers: string[]; // Telegram user IDs or usernames
}

export class TelegramAdapter implements ChannelPlugin {
  id = "telegram";
  name = "Telegram";

  private bot: Bot;
  private config: TelegramConfig;
  private running = false;
  private handler: ((msg: InboundMessage) => Promise<string>) | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.bot = new Bot(config.botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ACL check
    this.bot.use(async (ctx, next) => {
      if (this.config.allowedUsers.length === 0) {
        return next();
      }

      const userId = ctx.from?.id?.toString();
      const username = ctx.from?.username;

      const allowed = this.config.allowedUsers.some(
        (u) => u === userId || u === username,
      );

      if (!allowed) {
        await ctx.reply("You are not authorized to use this bot.");
        return;
      }

      return next();
    });

    // Handle text messages
    this.bot.on("message:text", async (ctx: Context) => {
      if (!this.handler || !ctx.message?.text) return;

      const message: InboundMessage = {
        channelId: this.id,
        userId: ctx.from?.id?.toString() ?? "unknown",
        userName: ctx.from?.username ?? ctx.from?.first_name,
        chatId: ctx.chat?.id?.toString() ?? "unknown",
        text: ctx.message.text,
        messageId: ctx.message.message_id,
      };

      try {
        const response = await this.handler(message);

        // Split long messages (Telegram has 4096 char limit)
        const chunks = splitMessage(response, 4000);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() => {
            // Fallback without markdown if parsing fails
            return ctx.reply(chunk);
          });
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "An error occurred";
        await ctx.reply(`Error: ${errMsg}`);
      }
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Start polling (non-blocking)
    this.bot.start({
      onStart: () => {
        console.log("[telegram] Bot started");
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.bot.stop();
    console.log("[telegram] Bot stopped");
  }

  onMessage(handler: (msg: InboundMessage) => Promise<string>): void {
    this.handler = handler;
  }

  async sendMessage(target: string, text: string): Promise<void> {
    const chunks = splitMessage(text, 4000);
    for (const chunk of chunks) {
      await this.bot.api.sendMessage(target, chunk, {
        parse_mode: "Markdown",
      }).catch(() => {
        return this.bot.api.sendMessage(target, chunk);
      });
    }
  }

  isRunning(): boolean {
    return this.running;
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

    // Try to break at a newline
    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt < maxLen / 2) {
      // No good newline, break at space
      breakAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (breakAt < maxLen / 2) {
      // No good break point, just cut
      breakAt = maxLen;
    }

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }

  return chunks;
}
