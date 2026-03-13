import { useNavigate, useLocation } from "react-router";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useChatStore } from "@/stores/chatStore";
import { useEffect, useSyncExternalStore, useCallback } from "react";
import { cn } from "@/lib/utils";
import { wsClient } from "@/lib/ws";
import { api, type ChannelType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MessageCircle,
    Wrench,
    Clock,
    Settings,
    Radio,
    Plus,
    Trash2,
    Download,
    MoreVertical,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportSessionAsMarkdown, downloadMarkdown } from "@/lib/exportSession";

const channelLogos: Record<ChannelType, string> = {
    whatsapp: "/logos/whatsapp.svg",
    telegram: "/logos/telegram.svg",
    discord: "/logos/discord.svg",
};

const navItems = [
    { path: "/", label: "Chat", icon: MessageCircle },
    { path: "/skills", label: "Skills", icon: Wrench },
    { path: "/channels", label: "Channels", icon: Radio },
    { path: "/cron", label: "Cron", icon: Clock },
    { path: "/settings", label: "Settings", icon: Settings },
];

function useConnected() {
    return useSyncExternalStore(
        (cb) => wsClient.onConnectionChange(cb),
        () => wsClient.connected,
    );
}

export function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeWorkspace } = useWorkspaceStore();
    const {
        sessions,
        fetchSessions,
        setActiveSession,
        activeSessionId,
        newSession,
    } = useChatStore();
    const connected = useConnected();

    useEffect(() => {
        if (activeWorkspace) {
            fetchSessions(activeWorkspace.id);
        }
    }, [activeWorkspace, fetchSessions]);

    const handleNewChat = () => {
        newSession();
        navigate("/");
    };

    const handleDeleteSession = useCallback(
        async (e: React.MouseEvent, sessionId: string) => {
            e.stopPropagation();
            if (!activeWorkspace) return;
            try {
                await api.sessions.delete(sessionId, activeWorkspace.id);
                if (sessionId === activeSessionId) {
                    newSession();
                }
                fetchSessions(activeWorkspace.id);
            } catch {
                // ignore
            }
        },
        [activeWorkspace, activeSessionId, newSession, fetchSessions],
    );

    const handleExportSession = useCallback(
        async (e: React.MouseEvent, sessionId: string) => {
            e.stopPropagation();
            if (!activeWorkspace) return;
            try {
                const session = await api.sessions.get(
                    sessionId,
                    activeWorkspace.id,
                );
                const md = exportSessionAsMarkdown(session);
                const safeName =
                    session.title
                        .replace(/[^a-zA-Z0-9-_ ]/g, "")
                        .slice(0, 50)
                        .trim() || "chat";
                downloadMarkdown(md, `${safeName}.md`);
            } catch {
                // ignore
            }
        },
        [activeWorkspace],
    );

    return (
        <aside className="flex h-full w-56 flex-col border-r bg-muted/40">
            {/* Branding */}
            <div
                className="flex h-14 items-center border-b px-4"
                style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
                <span className="text-lg font-semibold">Cortask</span>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 p-2">
                {navItems.map(({ path, label, icon: Icon }) => (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            location.pathname === path
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </nav>

            {/* Chats header + new chat */}
            <div className="flex items-center justify-between border-t px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                    Chats
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleNewChat}
                    title="New Chat"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Session List */}
            <ScrollArea className="flex-1 px-2 pb-2">
                <div className="min-w-0">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className={cn(
                                "group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors overflow-hidden",
                                session.id === activeSessionId
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent/50",
                            )}
                        >
                            <button
                                onClick={() => {
                                    if (activeWorkspace) {
                                        setActiveSession(
                                            session.id,
                                            activeWorkspace.id,
                                        );
                                        navigate("/");
                                    }
                                }}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left overflow-hidden"
                            >
                                {session.channel ? (
                                    <img
                                        src={channelLogos[session.channel]}
                                        alt={session.channel}
                                        className="h-3.5 w-3.5 shrink-0 opacity-70"
                                    />
                                ) : (
                                    <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                )}
                                <span className="truncate">
                                    {session.title}
                                </span>
                            </button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                                        <MoreVertical className="h-3.5 w-3.5" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-36"
                                >
                                    <DropdownMenuItem
                                        onClick={(e) =>
                                            handleExportSession(e, session.id)
                                        }
                                    >
                                        <Download className="mr-2 h-3.5 w-3.5" />
                                        Export
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={(e) =>
                                            handleDeleteSession(e, session.id)
                                        }
                                    >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Connection status footer */}
            <div className="border-t p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                        className={cn(
                            "h-2 w-2 rounded-full",
                            connected ? "bg-green-500" : "bg-red-500",
                        )}
                    />
                    {connected ? "Connected" : "Disconnected"}
                </div>
            </div>
        </aside>
    );
}
