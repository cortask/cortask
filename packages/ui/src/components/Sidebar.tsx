import { useNavigate, useLocation } from "react-router";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useChatStore } from "@/stores/chatStore";
import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { cn } from "@/lib/utils";
import { wsClient } from "@/lib/ws";
import { api, type ChannelType, type Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    FolderOpen,
    GripVertical,
    Pencil,
    X,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { exportSessionAsMarkdown, downloadMarkdown } from "@/lib/exportSession";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

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

function SortableProjectItem({
    ws,
    isActive,
    onSelect,
    onEdit,
    onRemove,
}: {
    ws: Workspace;
    isActive: boolean;
    onSelect: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onRemove: (e: React.MouseEvent) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: ws.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex w-full items-center gap-1 rounded-md px-1 py-1.5 text-sm transition-colors overflow-hidden",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
            )}
        >
            <button
                className="shrink-0 cursor-grab opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity touch-none"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3 w-3" />
            </button>
            <button
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left overflow-hidden"
            >
                <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{ws.name}</span>
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                        <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={onEdit}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={onRemove}
                    >
                        <X className="mr-2 h-3.5 w-3.5" />
                        Remove
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        createWorkspace,
        deleteWorkspace,
        reorderWorkspaces,
        fetchWorkspaces,
    } = useWorkspaceStore();
    const {
        sessions,
        fetchSessions,
        setActiveSession,
        activeSessionId,
        newSession,
    } = useChatStore();
    const connected = useConnected();

    // Project dialog state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addName, setAddName] = useState("");
    const [addRootPath, setAddRootPath] = useState("");
    const [defaultProjectsDir, setDefaultProjectsDir] = useState("");
    const [editProject, setEditProject] = useState<Workspace | null>(null);
    const [editName, setEditName] = useState("");
    const [removeConfirm, setRemoveConfirm] = useState<Workspace | null>(null);

    const isDesktop = !!(window as any).cortask;

    useEffect(() => {
        api.config.get().then((cfg) => {
            setDefaultProjectsDir(cfg.dataDir.replace(/\\/g, "/") + "/projects");
        }).catch(() => {});
    }, []);

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

    // Project handlers
    const handleAddProject = async () => {
        if (!addName.trim()) return;
        const ws = await createWorkspace(addName.trim(), addRootPath.trim() || undefined);
        newSession();
        setActiveWorkspace(ws);
        navigate("/");
        closeAddDialog();
    };

    const closeAddDialog = () => {
        setAddDialogOpen(false);
        setAddName("");
        setAddRootPath("");
    };

    const handleEditSave = async () => {
        if (!editProject || !editName.trim()) return;
        await api.workspaces.update(editProject.id, { name: editName.trim() });
        setEditProject(null);
        fetchWorkspaces();
    };

    const handleSelectProject = (ws: Workspace) => {
        newSession();
        setActiveWorkspace(ws);
        navigate("/");
    };

    const handleRemoveProject = async () => {
        if (!removeConfirm) return;
        await deleteWorkspace(removeConfirm.id);
        setRemoveConfirm(null);
        if (removeConfirm.id === activeWorkspace?.id) {
            newSession();
        }
    };

    // Drag-and-drop
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    );

    const handleProjectDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIdx = workspaces.findIndex((w) => w.id === active.id);
            const newIdx = workspaces.findIndex((w) => w.id === over.id);
            const reordered = arrayMove(workspaces, oldIdx, newIdx);
            reorderWorkspaces(reordered.map((w) => w.id));
        }
    };

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

            {/* Projects header + add button */}
            <div className="flex items-center justify-between border-t px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                    Projects
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setAddDialogOpen(true)}
                    title="New Project"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Project List (sortable) */}
            <ScrollArea className="shrink-0 max-h-40 px-2 pb-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleProjectDragEnd}
                >
                    <SortableContext
                        items={workspaces.map((w) => w.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {workspaces.map((ws) => (
                            <SortableProjectItem
                                key={ws.id}
                                ws={ws}
                                isActive={ws.id === activeWorkspace?.id}
                                onSelect={() => handleSelectProject(ws)}
                                onEdit={(e) => {
                                    e.stopPropagation();
                                    setEditProject(ws);
                                    setEditName(ws.name);
                                }}
                                onRemove={(e) => {
                                    e.stopPropagation();
                                    setRemoveConfirm(ws);
                                }}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </ScrollArea>

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
            <ScrollArea className="flex-1 min-h-0 px-2 pb-2">
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

            {/* Add Project Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={(open) => !open && closeAddDialog()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Project</DialogTitle>
                        <DialogDescription>
                            Give your project a name to get started.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Name</Label>
                            <Input
                                id="project-name"
                                value={addName}
                                onChange={(e) => setAddName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddProject();
                                }}
                                placeholder="My Project"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project-path">Folder</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="project-path"
                                    value={addRootPath}
                                    onChange={(e) => setAddRootPath(e.target.value)}
                                    placeholder={defaultProjectsDir || "Default location"}
                                    className="flex-1"
                                />
                                {isDesktop && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={async () => {
                                            const selected = await (window as any).cortask?.browseFolder?.();
                                            if (selected) setAddRootPath(selected);
                                        }}
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Leave empty to use the default location.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeAddDialog}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddProject} disabled={!addName.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Project Dialog */}
            <Dialog open={!!editProject} onOpenChange={(open) => !open && setEditProject(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-project-name">Name</Label>
                            <Input
                                id="edit-project-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditSave();
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-project-path">Folder</Label>
                            <Input
                                id="edit-project-path"
                                value={editProject?.rootPath ?? ""}
                                disabled
                                className="text-muted-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProject(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditSave} disabled={!editName.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Confirmation Dialog */}
            <Dialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Remove Project</DialogTitle>
                        <DialogDescription>
                            Remove &quot;{removeConfirm?.name}&quot; from the project list? The folder and its files will not be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemoveConfirm(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleRemoveProject}>
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </aside>
    );
}
