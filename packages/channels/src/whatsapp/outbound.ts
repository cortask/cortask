import type { WASocket } from "@whiskeysockets/baileys";

export function normalizeJID(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, "");
  return `${cleaned}@s.whatsapp.net`;
}

export async function sendMessage(
  socket: WASocket,
  target: string,
  text: string,
): Promise<void> {
  const jid = target.includes("@") ? target : normalizeJID(target);
  await socket.sendPresenceUpdate("composing", jid);
  await socket.sendMessage(jid, { text });
  await socket.sendPresenceUpdate("paused", jid);
}
