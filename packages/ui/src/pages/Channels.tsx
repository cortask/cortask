import { useState, useEffect, useCallback } from "react";
import { api, type ChannelStatus, type TrustedContact } from "@/lib/api";
import { wsClient, type WSMessage } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ChannelDef {
  id: string;
  name: string;
  logo: string;
  description: string;
  credentials: { key: string; label: string; type: "password" | "text" }[];
}

const CHANNELS: ChannelDef[] = [
  {
    id: "telegram",
    name: "Telegram",
    logo: "/logos/telegram.svg",
    description: "Connect a Telegram bot to receive and respond to messages.",
    credentials: [
      { key: "channel.telegram.botToken", label: "Bot Token", type: "password" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    logo: "/logos/whatsapp.svg",
    description: "Connect via WhatsApp Web using QR code authentication.",
    credentials: [],
  },
  {
    id: "discord",
    name: "Discord",
    logo: "/logos/discord.svg",
    description: "Connect a Discord bot to respond in servers and DMs.",
    credentials: [
      { key: "channel.discord.botToken", label: "Bot Token", type: "password" },
    ],
  },
];

export function ChannelsPage() {
  const [statuses, setStatuses] = useState<ChannelStatus[]>([]);
  const [credKeys, setCredKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<ChannelDef | null>(null);
  const [credInputs, setCredInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [chs, keys] = await Promise.all([
        api.channels.list().catch(() => [] as ChannelStatus[]),
        api.credentials.list().catch(() => [] as string[]),
      ]);
      setStatuses(chs);
      setCredKeys(keys);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for real-time channel status updates via WebSocket
  useEffect(() => {
    const unsub = wsClient.on("channel:status", (msg: WSMessage) => {
      if (msg.type !== "channel:status") return;
      setStatuses((prev) => {
        const idx = prev.findIndex((s) => s.id === msg.channelId);
        const updated: ChannelStatus = {
          id: msg.channelId,
          name: prev[idx]?.name ?? msg.channelId,
          running: msg.running,
          authenticated: msg.authenticated,
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });
    return () => { unsub(); };
  }, []);

  const getStatus = (id: string) => statuses.find((s) => s.id === id);

  const isConfigured = (ch: ChannelDef) => {
    if (ch.id === "whatsapp") return getStatus("whatsapp")?.authenticated ?? false;
    return ch.credentials.length === 0 || ch.credentials.every((c) => credKeys.includes(c.key));
  };

  const toggleChannel = async (id: string, running: boolean) => {
    try {
      if (running) {
        await api.channels.stop(id);
      } else {
        await api.channels.start(id);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle channel");
    }
  };

  const saveCredentials = async () => {
    const entries = Object.entries(credInputs).filter(([, v]) => v.trim() !== "");
    if (entries.length === 0) return;
    setSaving(true);
    try {
      for (const [key, value] of entries) {
        await api.credentials.set(key, value);
      }
      setCredInputs({});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive-foreground text-sm max-w-4xl mx-auto">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {CHANNELS.map((ch) => (
          <ChannelCard
            key={ch.id}
            channel={ch}
            status={getStatus(ch.id)}
            configured={isConfigured(ch)}
            onClick={() => setSelected(ch)}
          />
        ))}
      </div>

      {/* Channel Detail Modal */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setCredInputs({});
          }
        }}
      >
        {selected && (
          <ChannelDetail
            channel={selected}
            status={getStatus(selected.id)}
            configured={isConfigured(selected)}
            credKeys={credKeys}
            credInputs={credInputs}
            saving={saving}
            onCredChange={(key, value) =>
              setCredInputs((prev) => ({ ...prev, [key]: value }))
            }
            onSave={saveCredentials}
            onToggle={toggleChannel}
            onRefresh={loadData}
            onError={setError}
          />
        )}
      </Dialog>
    </div>
  );
}

function ChannelCard({
  channel,
  status,
  configured,
  onClick,
}: {
  channel: ChannelDef;
  status: ChannelStatus | undefined;
  configured: boolean;
  onClick: () => void;
}) {
  const running = status?.running ?? false;

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden flex flex-col items-center gap-3 rounded-lg border bg-card p-5 transition-colors hover:bg-accent/50 text-center"
    >
      <Badge
        className={cn(
          "absolute top-2 right-2 text-[10px] px-1.5 py-0",
          running
            ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/40"
            : configured
              ? "text-muted-foreground border-border bg-transparent hover:bg-transparent"
              : "text-yellow-600 border-yellow-300 bg-yellow-50 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/30",
        )}
        variant={running ? "default" : "outline"}
      >
        {running ? "Running" : configured ? "Stopped" : "Not configured"}
      </Badge>

      <img src={channel.logo} alt={channel.name} className="h-8 w-8" />

      <span className="text-sm font-medium">{channel.name}</span>

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {channel.description}
      </p>

      {running && (
        <div
          className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-16 w-3/4 rounded-[50%]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(74, 222, 128, 0.45) 0%, rgba(74, 222, 128, 0.15) 40%, transparent 70%)",
          }}
        />
      )}
    </button>
  );
}

function ChannelDetail({
  channel,
  status,
  configured,
  credKeys,
  credInputs,
  saving,
  onCredChange,
  onSave,
  onToggle,
  onRefresh,
  onError,
}: {
  channel: ChannelDef;
  status: ChannelStatus | undefined;
  configured: boolean;
  credKeys: string[];
  credInputs: Record<string, string>;
  saving: boolean;
  onCredChange: (key: string, value: string) => void;
  onSave: () => void;
  onToggle: (id: string, running: boolean) => void;
  onRefresh: () => void;
  onError: (msg: string) => void;
}) {
  const running = status?.running ?? false;

  return (
    <DialogContent className="max-w-md bg-card max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <img src={channel.logo} alt={channel.name} className="h-8 w-8" />
          <DialogTitle>{channel.name}</DialogTitle>
        </div>
        <DialogDescription>{channel.description}</DialogDescription>
      </DialogHeader>

      {/* Credentials (Telegram, Discord) */}
      {channel.credentials.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <h4 className="text-sm font-medium">Credentials</h4>
          {channel.credentials.map((cred) => {
            const fulfilled = credKeys.includes(cred.key);
            return (
              <div key={cred.key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      fulfilled ? "bg-green-500" : "bg-yellow-500",
                    )}
                  />
                  <label className="text-xs font-medium text-muted-foreground">
                    {cred.label}
                  </label>
                  {fulfilled && (
                    <span className="text-xs text-muted-foreground">
                      — Configured
                    </span>
                  )}
                </div>
                <Input
                  type={cred.type}
                  value={credInputs[cred.key] ?? ""}
                  onChange={(e) => onCredChange(cred.key, e.target.value)}
                  placeholder={
                    fulfilled
                      ? `Update ${cred.label.toLowerCase()}...`
                      : `Enter ${cred.label.toLowerCase()}...`
                  }
                />
              </div>
            );
          })}
          <Button
            onClick={onSave}
            disabled={saving || !Object.values(credInputs).some((v) => v.trim() !== "")}
            className="w-full"
          >
            {saving ? "Saving..." : "Save credentials"}
          </Button>
        </div>
      )}

      {/* WhatsApp QR auth */}
      {channel.id === "whatsapp" && (
        <>
          <WhatsAppAuth
            authenticated={status?.authenticated ?? false}
            running={running}
            onRefresh={onRefresh}
            onError={onError}
          />
          <TrustedContacts onError={onError} />
        </>
      )}

      {/* Start / Stop */}
      <div className="flex items-center justify-between pt-1">
        <Badge
          className={
            running
              ? "bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/30"
              : ""
          }
          variant={running ? "default" : "secondary"}
        >
          {running ? "Running" : "Stopped"}
        </Badge>
        <Button
          variant={running ? "destructive" : "default"}
          size="sm"
          className={
            !running ? "bg-green-700 hover:bg-green-600 text-white" : ""
          }
          onClick={() => onToggle(channel.id, running)}
          disabled={!configured && !running}
        >
          {running ? "Stop" : "Start"}
        </Button>
      </div>
    </DialogContent>
  );
}

function WhatsAppAuth({
  authenticated,
  running,
  onRefresh,
  onError,
}: {
  authenticated: boolean;
  running: boolean;
  onRefresh: () => void;
  onError: (msg: string) => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingForScan, setWaitingForScan] = useState(false);

  // Listen for channel status updates to detect successful scan
  useEffect(() => {
    if (!waitingForScan) return;
    const unsub = wsClient.on("channel:status", (msg: WSMessage) => {
      if (msg.type !== "channel:status" || msg.channelId !== "whatsapp") return;
      if (msg.authenticated) {
        setWaitingForScan(false);
        setQrUrl(null);
        onRefresh();
      }
    });
    return () => { unsub(); };
  }, [waitingForScan, onRefresh]);

  const generateQR = async () => {
    setLoading(true);
    setQrUrl(null);
    setWaitingForScan(false);
    try {
      const result = await api.channels.whatsappQR();
      if (result.success && result.qrDataUrl) {
        setQrUrl(result.qrDataUrl);
        setWaitingForScan(true);
      } else {
        onError(result.message || "Failed to generate QR code");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.channels.whatsappLogout();
      setQrUrl(null);
      setWaitingForScan(false);
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to logout");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Authentication</h4>
        {authenticated && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Connected</span>
          </div>
        )}
      </div>

      {qrUrl && (
        <div className="flex flex-col items-center gap-2">
          <img src={qrUrl} alt="WhatsApp QR Code" className="w-48 h-48 rounded-lg" />
          {waitingForScan && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <p className="text-xs text-muted-foreground">
                Waiting for scan... will auto-connect
              </p>
            </div>
          )}
        </div>
      )}

      {!authenticated && !qrUrl && (
        <p className="text-xs text-muted-foreground">
          Scan a QR code with your phone to link WhatsApp.
        </p>
      )}

      <div className="flex gap-2">
        {!authenticated && (
          <Button
            onClick={generateQR}
            disabled={loading}
            size="sm"
            className="flex-1"
          >
            {loading ? "Generating..." : qrUrl ? "Refresh QR" : "Generate QR Code"}
          </Button>
        )}
        {authenticated && !running && (
          <Button onClick={logout} variant="destructive" size="sm">
            Logout
          </Button>
        )}
      </div>
    </div>
  );
}

function TrustedContacts({ onError }: { onError: (msg: string) => void }) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newPerm, setNewPerm] = useState<TrustedContact["permission"]>("write");

  useEffect(() => {
    api.channels.whatsappContacts()
      .then((c) => { setContacts(c); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const save = async (updated: TrustedContact[]) => {
    setSaving(true);
    try {
      await api.channels.whatsappSetContacts(updated);
      setContacts(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save contacts");
    } finally {
      setSaving(false);
    }
  };

  const addContact = () => {
    const phone = newPhone.trim();
    if (!phone) return;
    if (contacts.some((c) => c.phone === phone)) {
      onError("Contact already exists");
      return;
    }
    const updated = [...contacts, { phone, name: newName.trim() || undefined, permission: newPerm }];
    setNewPhone("");
    setNewName("");
    save(updated);
  };

  const removeContact = (phone: string) => {
    save(contacts.filter((c) => c.phone !== phone));
  };

  const updatePermission = (phone: string, permission: TrustedContact["permission"]) => {
    save(contacts.map((c) => c.phone === phone ? { ...c, permission } : c));
  };

  if (!loaded) return null;

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <h4 className="text-sm font-medium">Trusted Contacts</h4>
      <p className="text-xs text-muted-foreground">
        Only these numbers can interact with the bot. Leave empty to allow everyone.
      </p>

      {contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.phone} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs">{c.phone}</span>
                {c.name && (
                  <span className="text-xs text-muted-foreground ml-2">{c.name}</span>
                )}
              </div>
              <select
                value={c.permission}
                onChange={(e) => updatePermission(c.phone, e.target.value as TrustedContact["permission"])}
                className="text-xs bg-background border rounded px-1.5 py-1"
                disabled={saving}
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeContact(c.phone)}
                disabled={saving}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone (e.g. 491234567890)"
            className="flex-1 text-xs h-8"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (optional)"
            className="w-28 text-xs h-8"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={newPerm}
            onChange={(e) => setNewPerm(e.target.value as TrustedContact["permission"])}
            className="text-xs bg-background border rounded px-1.5 py-1 h-8"
          >
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            onClick={addContact}
            disabled={saving || !newPhone.trim()}
            size="sm"
            className="h-8"
          >
            {saving ? "Saving..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
