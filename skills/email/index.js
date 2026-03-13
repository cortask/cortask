import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const SKILL_NAME = "email";
const CRED_ID = "account";

/**
 * Get instance registry and resolve the target account.
 */
async function getAccountCredentials(credentialStore, accountId) {
  const registryKey = `skill.${SKILL_NAME}.${CRED_ID}._instances`;
  const raw = await credentialStore.get(registryKey);
  const instances = raw ? JSON.parse(raw) : [];

  if (instances.length === 0) {
    throw new Error("No email accounts configured. Add one in Settings > Skills > Email.");
  }

  const instance = accountId
    ? instances.find((i) => i.id === accountId || i.label.toLowerCase() === String(accountId).toLowerCase())
    : instances[0];

  if (!instance) {
    const available = instances.map((i) => i.label).join(", ");
    throw new Error(`Account "${accountId}" not found. Available: ${available}`);
  }

  const prefix = `skill.${SKILL_NAME}.${CRED_ID}.${instance.id}`;
  const email = await credentialStore.get(`${prefix}.email`);
  const imapHost = await credentialStore.get(`${prefix}.imapHost`);
  const imapPort = await credentialStore.get(`${prefix}.imapPort`);
  const smtpHost = await credentialStore.get(`${prefix}.smtpHost`);
  const smtpPort = await credentialStore.get(`${prefix}.smtpPort`);
  const password = await credentialStore.get(`${prefix}.password`);

  return {
    id: instance.id,
    label: instance.label,
    email,
    imapHost,
    imapPort: parseInt(imapPort || "993", 10),
    smtpHost,
    smtpPort: parseInt(smtpPort || "465", 10),
    password,
  };
}

/**
 * Create an IMAP client, run a callback, then close.
 */
async function withImap(account, callback) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: true,
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.logout();
  }
}

/**
 * Create an SMTP transporter.
 */
function createTransporter(account) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: {
      user: account.email,
      pass: account.password,
    },
  });
}

/**
 * Format an email message for display.
 */
function formatMessage(parsed, seq) {
  const from = parsed.from?.text || "Unknown";
  const to = parsed.to?.text || "";
  const subject = parsed.subject || "(no subject)";
  const date = parsed.date?.toISOString() || "";
  const text = parsed.text || "";

  let result = `#${seq} | ${date}\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\n`;
  if (parsed.cc) result += `Cc: ${parsed.cc.text}\n`;
  result += `\n${text.slice(0, 3000)}`;
  if (text.length > 3000) result += "\n...(truncated)";
  return result;
}

export const tools = [
  {
    name: "list_email_accounts",
    description: "List all configured email accounts. Call this first to discover available accounts.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (_args, { credentialStore }) => {
      const registryKey = `skill.${SKILL_NAME}.${CRED_ID}._instances`;
      const raw = await credentialStore.get(registryKey);
      const instances = raw ? JSON.parse(raw) : [];

      if (instances.length === 0) {
        return { content: "No email accounts configured." };
      }

      const lines = [];
      for (const inst of instances) {
        const email = await credentialStore.get(
          `skill.${SKILL_NAME}.${CRED_ID}.${inst.id}.email`,
        );
        lines.push(`- ${inst.label} (${email || "unknown"}) [id: ${inst.id}]`);
      }

      return { content: `Configured email accounts:\n${lines.join("\n")}` };
    },
  },

  {
    name: "read_emails",
    description: "Read emails from an inbox folder. Returns a list of messages with sender, subject, date, and preview.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID. Omit to use the first configured account.",
        },
        folder: {
          type: "string",
          description: 'Mailbox folder to read from. Default: "INBOX".',
        },
        limit: {
          type: "number",
          description: "Maximum number of messages to return. Default: 10.",
        },
        unread_only: {
          type: "boolean",
          description: "If true, only return unread (unseen) messages.",
        },
      },
      required: [],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const folder = args.folder || "INBOX";
      const limit = Math.min(args.limit || 10, 50);
      const unreadOnly = args.unread_only ?? false;

      return withImap(account, async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
          const mailbox = client.mailbox;
          const total = mailbox.exists || 0;

          if (total === 0) {
            return { content: `${folder} is empty.` };
          }

          const messages = [];
          const query = unreadOnly ? { seen: false } : { all: true };
          const range = unreadOnly ? "1:*" : `${Math.max(1, total - limit + 1)}:*`;

          for await (const msg of client.fetch(range, {
            envelope: true,
            flags: true,
          })) {
            if (unreadOnly && msg.flags.has("\\Seen")) continue;
            const from = msg.envelope.from?.[0];
            const fromStr = from
              ? `${from.name || ""} <${from.address || ""}>`
              : "Unknown";
            const flags = [...msg.flags].join(", ");
            messages.push(
              `#${msg.seq} | ${msg.envelope.date?.toISOString() || ""}\n  From: ${fromStr}\n  Subject: ${msg.envelope.subject || "(no subject)"}\n  Flags: ${flags}`,
            );
            if (messages.length >= limit) break;
          }

          if (messages.length === 0) {
            return {
              content: unreadOnly
                ? `No unread messages in ${folder}.`
                : `No messages found in ${folder}.`,
            };
          }

          return {
            content: `${folder} (${total} total) — showing ${messages.length}:\n\n${messages.join("\n\n")}`,
          };
        } finally {
          lock.release();
        }
      });
    },
  },

  {
    name: "read_email",
    description: "Read the full content of a specific email by its sequence number.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID.",
        },
        seq: {
          type: "number",
          description: "Message sequence number (from read_emails output).",
        },
        folder: {
          type: "string",
          description: 'Mailbox folder. Default: "INBOX".',
        },
      },
      required: ["seq"],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const folder = args.folder || "INBOX";
      const seq = args.seq;

      return withImap(account, async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
          const msg = await client.fetchOne(`${seq}`, {
            source: true,
          });

          if (!msg?.source) {
            return { content: `Message #${seq} not found.`, isError: true };
          }

          const parsed = await simpleParser(msg.source);
          return { content: formatMessage(parsed, seq) };
        } finally {
          lock.release();
        }
      });
    },
  },

  {
    name: "search_emails",
    description: "Search emails by query string (searches subject and body).",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID.",
        },
        query: {
          type: "string",
          description: "Search query (matched against subject and body text).",
        },
        folder: {
          type: "string",
          description: 'Mailbox folder. Default: "INBOX".',
        },
        limit: {
          type: "number",
          description: "Maximum results. Default: 10.",
        },
      },
      required: ["query"],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const folder = args.folder || "INBOX";
      const limit = Math.min(args.limit || 10, 50);

      return withImap(account, async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
          const results = await client.search({
            or: [
              { subject: args.query },
              { body: args.query },
            ],
          });

          if (results.length === 0) {
            return { content: `No messages matching "${args.query}" in ${folder}.` };
          }

          // Take the last N results (most recent)
          const seqs = results.slice(-limit);
          const messages = [];

          for await (const msg of client.fetch(seqs, {
            envelope: true,
            flags: true,
          })) {
            const from = msg.envelope.from?.[0];
            const fromStr = from
              ? `${from.name || ""} <${from.address || ""}>`
              : "Unknown";
            messages.push(
              `#${msg.seq} | ${msg.envelope.date?.toISOString() || ""}\n  From: ${fromStr}\n  Subject: ${msg.envelope.subject || "(no subject)"}`,
            );
          }

          return {
            content: `Found ${results.length} results for "${args.query}" — showing ${messages.length}:\n\n${messages.join("\n\n")}`,
          };
        } finally {
          lock.release();
        }
      });
    },
  },

  {
    name: "send_email",
    description: "Send a new email.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID.",
        },
        to: {
          type: "string",
          description: "Recipient email address(es), comma-separated.",
        },
        subject: {
          type: "string",
          description: "Email subject line.",
        },
        body: {
          type: "string",
          description: "Email body text.",
        },
        cc: {
          type: "string",
          description: "CC recipients, comma-separated.",
        },
        bcc: {
          type: "string",
          description: "BCC recipients, comma-separated.",
        },
      },
      required: ["to", "subject", "body"],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const transporter = createTransporter(account);

      const info = await transporter.sendMail({
        from: account.email,
        to: args.to,
        subject: args.subject,
        text: args.body,
        cc: args.cc || undefined,
        bcc: args.bcc || undefined,
      });

      return {
        content: `Email sent successfully.\nMessage ID: ${info.messageId}\nTo: ${args.to}\nSubject: ${args.subject}`,
      };
    },
  },

  {
    name: "reply_email",
    description: "Reply to an existing email by its sequence number.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID.",
        },
        seq: {
          type: "number",
          description: "Sequence number of the message to reply to.",
        },
        body: {
          type: "string",
          description: "Reply body text.",
        },
        folder: {
          type: "string",
          description: 'Mailbox folder. Default: "INBOX".',
        },
        reply_all: {
          type: "boolean",
          description: "Reply to all recipients. Default: false.",
        },
      },
      required: ["seq", "body"],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const folder = args.folder || "INBOX";

      // Fetch original message
      const original = await withImap(account, async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
          const msg = await client.fetchOne(`${args.seq}`, {
            source: true,
          });
          if (!msg?.source) return null;
          return simpleParser(msg.source);
        } finally {
          lock.release();
        }
      });

      if (!original) {
        return { content: `Message #${args.seq} not found.`, isError: true };
      }

      const replyTo = original.replyTo?.text || original.from?.text;
      if (!replyTo) {
        return { content: "Cannot determine reply address.", isError: true };
      }

      const subject = original.subject?.startsWith("Re:")
        ? original.subject
        : `Re: ${original.subject || ""}`;

      const mailOptions = {
        from: account.email,
        to: replyTo,
        subject,
        text: args.body,
        inReplyTo: original.messageId,
        references: original.messageId,
      };

      if (args.reply_all) {
        const allRecipients = new Set();
        if (original.to) {
          for (const addr of original.to.value) {
            if (addr.address && addr.address !== account.email) {
              allRecipients.add(addr.address);
            }
          }
        }
        if (original.cc) {
          for (const addr of original.cc.value) {
            if (addr.address && addr.address !== account.email) {
              allRecipients.add(addr.address);
            }
          }
        }
        if (allRecipients.size > 0) {
          mailOptions.cc = [...allRecipients].join(", ");
        }
      }

      const transporter = createTransporter(account);
      const info = await transporter.sendMail(mailOptions);

      return {
        content: `Reply sent successfully.\nMessage ID: ${info.messageId}\nTo: ${replyTo}\nSubject: ${subject}`,
      };
    },
  },

  {
    name: "move_email",
    description: "Move an email to a different folder.",
    inputSchema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Account label or ID.",
        },
        seq: {
          type: "number",
          description: "Sequence number of the message to move.",
        },
        destination: {
          type: "string",
          description: 'Destination folder (e.g. "Trash", "Archive", "[Gmail]/All Mail").',
        },
        folder: {
          type: "string",
          description: 'Source folder. Default: "INBOX".',
        },
      },
      required: ["seq", "destination"],
    },
    execute: async (args, { credentialStore }) => {
      const account = await getAccountCredentials(credentialStore, args.account);
      const folder = args.folder || "INBOX";

      return withImap(account, async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
          await client.messageMove(`${args.seq}`, args.destination);
          return {
            content: `Message #${args.seq} moved from ${folder} to ${args.destination}.`,
          };
        } finally {
          lock.release();
        }
      });
    },
  },
];
