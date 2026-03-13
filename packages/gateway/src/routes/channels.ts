import { Router } from "express";
import type { WebSocketServer } from "ws";
import type { ChannelPlugin } from "@cortask/channels";
import { WhatsAppAdapter } from "@cortask/channels";
import type { TrustedContact } from "@cortask/channels";
import type { GatewayContext } from "../server.js";
import { broadcastChannelStatus } from "../ws.js";

export function createChannelRoutes(
  channels: Map<string, ChannelPlugin>,
  ctx: GatewayContext,
  createChannel: (id: string) => Promise<ChannelPlugin | null>,
  wss: WebSocketServer,
): Router {
  const router = Router();

  const KNOWN_CHANNELS = [
    { id: "telegram", name: "Telegram" },
    { id: "whatsapp", name: "WhatsApp" },
    { id: "discord", name: "Discord" },
  ];

  // List channel statuses
  router.get("/", (_req, res) => {
    const result = KNOWN_CHANNELS.map((def) => {
      const ch = channels.get(def.id);
      const base = { id: def.id, name: ch?.name ?? def.name, running: ch?.isRunning() ?? false };
      // Add WhatsApp auth status
      if (def.id === "whatsapp") {
        const wa = ch as WhatsAppAdapter | undefined;
        return { ...base, authenticated: wa?.isAuthenticated() ?? new WhatsAppAdapter().isAuthenticated() };
      }
      return base;
    });
    res.json(result);
  });

  // Start a channel (create on-demand if needed)
  router.post("/:id/start", async (req, res) => {
    const { id } = req.params;
    let channel = channels.get(id);

    if (!channel) {
      try {
        const created = await createChannel(id);
        if (!created) {
          res.status(400).json({ error: `No credentials configured for ${id}` });
          return;
        }
        channel = created;
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
      channels.set(id, channel);
    }

    try {
      await channel.start();
      await ctx.credentialStore.set(`channel.${id}.enabled`, "true");
      broadcastChannelStatus(wss, { channelId: id, running: true, authenticated: true });
      res.json({ id, name: channel.name, running: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Stop a channel
  router.post("/:id/stop", async (req, res) => {
    const channel = channels.get(req.params.id);
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    try {
      await channel.stop();
      await ctx.credentialStore.delete(`channel.${req.params.id}.enabled`);
      broadcastChannelStatus(wss, { channelId: req.params.id, running: false, authenticated: false });
      res.json({ id: req.params.id, name: channel.name, running: false });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // WhatsApp: generate QR code for authentication + auto-start after scan
  router.post("/whatsapp/qr", async (_req, res) => {
    try {
      // Ensure adapter exists
      let wa = channels.get("whatsapp") as WhatsAppAdapter | undefined;
      if (!wa) {
        const created = await createChannel("whatsapp");
        if (!created) {
          res.status(500).json({ error: "Failed to create WhatsApp adapter" });
          return;
        }
        wa = created as WhatsAppAdapter;
        channels.set("whatsapp", wa);
      }

      const result = await wa.generateQR();
      res.json(result);

      // After returning QR, poll for authentication and auto-start
      if (result.success) {
        const pollInterval = 2000;
        const maxPolls = 30; // 60 seconds
        let polls = 0;

        const poller = setInterval(async () => {
          polls++;
          try {
            if (wa!.isAuthenticated() && !wa!.isRunning()) {
              clearInterval(poller);
              await wa!.start();
              await ctx.credentialStore.set("channel.whatsapp.enabled", "true");
              broadcastChannelStatus(wss, { channelId: "whatsapp", running: true, authenticated: true });
            } else if (polls >= maxPolls) {
              clearInterval(poller);
              // Still broadcast auth status even if we don't auto-start
              if (wa!.isAuthenticated()) {
                broadcastChannelStatus(wss, { channelId: "whatsapp", running: false, authenticated: true });
              }
            }
          } catch (err) {
            clearInterval(poller);
            console.error("[whatsapp] Auto-start failed:", err);
          }
        }, pollInterval);
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // WhatsApp: logout and clear auth
  router.post("/whatsapp/logout", async (_req, res) => {
    const wa = channels.get("whatsapp") as WhatsAppAdapter | undefined;
    if (!wa) {
      // Clear auth even without an adapter instance
      new WhatsAppAdapter().logout();
      res.json({ success: true });
      return;
    }
    try {
      await wa.logout();
      await ctx.credentialStore.delete("channel.whatsapp.enabled");
      broadcastChannelStatus(wss, { channelId: "whatsapp", running: false, authenticated: false });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // WhatsApp: get trusted contacts
  router.get("/whatsapp/contacts", async (_req, res) => {
    try {
      const json = await ctx.credentialStore.get("channel.whatsapp.trustedContacts");
      const contacts: TrustedContact[] = json ? JSON.parse(json) : [];
      res.json(contacts);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // WhatsApp: save trusted contacts
  router.put("/whatsapp/contacts", async (req, res) => {
    try {
      const contacts: TrustedContact[] = req.body;
      await ctx.credentialStore.set("channel.whatsapp.trustedContacts", JSON.stringify(contacts));

      // Update running adapter if present
      const wa = channels.get("whatsapp") as WhatsAppAdapter | undefined;
      if (wa) {
        wa.setTrustedContacts(contacts);
      }

      res.json(contacts);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
