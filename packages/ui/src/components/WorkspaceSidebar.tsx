import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { api, type Workspace, type CronJobWithState, type MemoryEntry, type MemorySearchResult } from "@/lib/api";
import { onCronChange } from "@/lib/events";
import { usePreviewStore } from "@/stores/previewStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Eye,
  RefreshCw,
  Clock,
  Pencil,
  Plus,
  GripHorizontal,
  Search,
  Brain,
  Trash2,
} from "lucide-react";

interface TreeEntry {
  path: string;
  name: string;
  type: "file" | "dir";
}

interface TreeNode {
  entry: TreeEntry;
  children: TreeNode[];
}

function buildTree(flat: TreeEntry[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const entry of flat) {
    const node: TreeNode = { entry, children: [] };
    nodeMap.set(entry.path, node);

    const parentPath = entry.path.includes("/")
      ? entry.path.substring(0, entry.path.lastIndexOf("/"))
      : null;

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.substring(idx + 1) : "";
}

function FileTreeNode({
  node,
  workspaceId,
  selectedFiles,
  onToggle,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  workspaceId: string;
  selectedFiles: string[];
  onToggle: (path: string, ctrlKey: boolean) => void;
  onRename: (path: string, name: string) => void;
  onDelete: (path: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = usePreviewStore((s) => s.open);
  const isSelected = selectedFiles.includes(node.entry.path);
  const isFile = node.entry.type === "file";

  const contextMenuItems = (
    <>
      {isFile && (
        <>
          <ContextMenuItem
            onClick={() => {
              const ext = getExtension(node.entry.name);
              preview({
                title: node.entry.name,
                url: `/api/workspaces/${workspaceId}/files/${node.entry.path}`,
                type: ext,
              });
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem onClick={() => onRename(node.entry.path, node.entry.name)}>
        <Pencil className="h-3.5 w-3.5" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => onDelete(node.entry.path, node.entry.name)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </ContextMenuItem>
    </>
  );

  if (node.entry.type === "dir") {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                {open ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                {open ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                )}
                <span className="truncate">{node.entry.name}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-3">
                {node.children.map((child) => (
                  <FileTreeNode
                    key={child.entry.path}
                    node={child}
                    workspaceId={workspaceId}
                    selectedFiles={selectedFiles}
                    onToggle={onToggle}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-36">
          {contextMenuItems}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`group flex items-center gap-1.5 rounded px-1.5 py-1 text-sm cursor-pointer ${
            isSelected
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          }`}
          onClick={(e) => onToggle(node.entry.path, e.ctrlKey || e.metaKey)}
        >
          <File className="h-3.5 w-3.5 shrink-0 ml-4" />
          <span className="truncate flex-1">{node.entry.name}</span>
          <button
            type="button"
            className="hidden group-hover:flex h-4 w-4 items-center justify-center rounded hover:bg-accent shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              const ext = getExtension(node.entry.name);
              preview({
                title: node.entry.name,
                url: `/api/workspaces/${workspaceId}/files/${node.entry.path}`,
                type: ext,
              });
            }}
            title="Preview"
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        {contextMenuItems}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// --- Resize handle ---

function ResizeHandle({
  onDragStart,
  onDrag,
}: {
  onDragStart: () => void;
  onDrag: (deltaY: number) => void;
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    onDragStart();

    const onMove = (ev: PointerEvent) => {
      onDrag(ev.clientY - startY);
    };

    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center border-y border-border hover:bg-accent/50 transition-colors"
    >
      <GripHorizontal className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </div>
  );
}

// --- Main sidebar ---

interface WorkspaceSidebarProps {
  workspace: Workspace;
  selectedFiles: string[];
  onSelectedFilesChange: (files: string[]) => void;
}

const MIN_SECTION_HEIGHT = 48;

export function WorkspaceSidebar({
  workspace,
  selectedFiles,
  onSelectedFilesChange,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Section heights as fractions (summing to 1)
  const [fractions, setFractions] = useState([1 / 3, 1 / 3, 1 / 3]);
  const dragStartFracs = useRef<number[]>([]);

  const handleDragStart = useCallback(
    (handleIndex: number) => () => {
      void handleIndex;
      dragStartFracs.current = [...fractions];
    },
    [fractions],
  );

  const handleResize = useCallback(
    (handleIndex: number) => (deltaY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const totalHeight = container.clientHeight - 16;
      if (totalHeight <= 0) return;

      const start = dragStartFracs.current;
      if (!start.length) return;

      const deltaFrac = deltaY / totalHeight;
      const newFracs = [...start];
      newFracs[handleIndex] = start[handleIndex] + deltaFrac;
      newFracs[handleIndex + 1] = start[handleIndex + 1] - deltaFrac;

      const minFrac = MIN_SECTION_HEIGHT / totalHeight;
      if (newFracs[handleIndex] < minFrac || newFracs[handleIndex + 1] < minFrac) {
        return;
      }

      setFractions(newFracs);
    },
    [],
  );

  // File tree
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const fetchTree = useCallback(() => {
    setTreeLoading(true);
    api.workspaces
      .getTree(workspace.id)
      .then((r) => setTree(r.tree))
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [workspace.id]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const treeNodes = buildTree(tree);

  const handleFileToggle = (path: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      if (selectedFiles.includes(path)) {
        onSelectedFilesChange(selectedFiles.filter((f) => f !== path));
      } else {
        onSelectedFilesChange([...selectedFiles, path]);
      }
    } else {
      if (selectedFiles.length === 1 && selectedFiles[0] === path) {
        onSelectedFilesChange([]);
      } else {
        onSelectedFilesChange([path]);
      }
    }
  };

  // File rename/delete
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);

  const handleRenameStart = (filePath: string, fileName: string) => {
    setRenameTarget({ path: filePath, name: fileName });
    setRenameDraft(fileName);
  };

  const handleRenameConfirm = async () => {
    if (!renameTarget || !renameDraft.trim() || renameDraft === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const dir = renameTarget.path.includes("/")
      ? renameTarget.path.substring(0, renameTarget.path.lastIndexOf("/") + 1)
      : "";
    try {
      await api.workspaces.renameFile(workspace.id, renameTarget.path, dir + renameDraft.trim());
      fetchTree();
    } catch (err) {
      console.error("Rename failed:", err);
    }
    setRenameTarget(null);
  };

  const handleDeleteStart = (filePath: string, fileName: string) => {
    setDeleteTarget({ path: filePath, name: fileName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.workspaces.deleteFile(workspace.id, deleteTarget.path);
      onSelectedFilesChange(selectedFiles.filter((f) => f !== deleteTarget.path));
      fetchTree();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteTarget(null);
  };

  // Memory (pinned notes)
  const [memory, setMemory] = useState<string | null>(null);
  const [memoryEditOpen, setMemoryEditOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");

  // Memory search (structured DB)
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryResults, setMemoryResults] = useState<MemorySearchResult[]>([]);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [memorySearching, setMemorySearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.workspaces
      .readMemory(workspace.id)
      .then((r) => setMemory(r.content))
      .catch(() => {});
    // Load recent entries
    api.workspaces
      .listMemoryEntries(workspace.id, 10)
      .then(setMemoryEntries)
      .catch(() => {});
  }, [workspace.id]);

  // Debounced search
  useEffect(() => {
    if (!memoryQuery.trim()) {
      setMemoryResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setMemorySearching(true);
      try {
        const results = await api.workspaces.searchMemory(workspace.id, memoryQuery.trim());
        setMemoryResults(results);
      } catch {
        setMemoryResults([]);
      } finally {
        setMemorySearching(false);
      }
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [memoryQuery, workspace.id]);

  const handleMemoryEdit = () => {
    setMemoryDraft(memory ?? "");
    setMemoryEditOpen(true);
  };

  const handleMemorySave = async () => {
    await api.workspaces.writeMemory(workspace.id, memoryDraft);
    setMemory(memoryDraft);
    setMemoryEditOpen(false);
  };

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Cron jobs
  const [cronJobs, setCronJobs] = useState<CronJobWithState[]>([]);

  const fetchCronJobs = useCallback(() => {
    api.cron
      .list(workspace.id)
      .then(setCronJobs)
      .catch(() => {});
  }, [workspace.id]);

  useEffect(() => {
    fetchCronJobs();
  }, [fetchCronJobs]);

  // Refresh when cron jobs change (from Cron page or agent)
  useEffect(() => {
    return onCronChange(fetchCronJobs);
  }, [fetchCronJobs]);

  return (
    <>
      <div
        ref={containerRef}
        className="flex h-full w-[280px] shrink-0 flex-col border-l bg-background"
      >
        {/* Files Section */}
        <div
          className="flex flex-col min-h-0"
          style={{ flex: `${fractions[0]} 1 0%` }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Files
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={fetchTree}
              disabled={treeLoading}
            >
              <RefreshCw
                className={`h-3 w-3 ${treeLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-3 pb-1">
            {tree.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                {treeLoading ? "Loading..." : "No files yet."}
              </p>
            ) : (
              <div className="space-y-0.5">
                {treeNodes.map((node) => (
                  <FileTreeNode
                    key={node.entry.path}
                    node={node}
                    workspaceId={workspace.id}
                    selectedFiles={selectedFiles}
                    onToggle={handleFileToggle}
                    onRename={handleRenameStart}
                    onDelete={handleDeleteStart}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <ResizeHandle onDragStart={handleDragStart(0)} onDrag={handleResize(0)} />

        {/* Memory Section */}
        <div
          className="flex flex-col min-h-0"
          style={{ flex: `${fractions[1]} 1 0%` }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Memory
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleMemoryEdit}
              title="Edit pinned notes"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <div className="px-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memoryQuery}
                onChange={(e) => setMemoryQuery(e.target.value)}
                placeholder="Search memories..."
                className="h-7 pl-7 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-3 pb-1">
            {memoryQuery.trim() ? (
              // Search results
              memorySearching ? (
                <p className="text-xs text-muted-foreground px-1">Searching...</p>
              ) : memoryResults.length > 0 ? (
                <ul className="space-y-1.5">
                  {memoryResults.map((r) => (
                    <li key={r.entry.id} className="rounded border border-border/50 px-2 py-1.5">
                      <p className="text-sm text-foreground line-clamp-3">
                        {r.entry.content}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {r.matchType}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {r.score.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatRelativeTime(r.entry.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground px-1">No results found.</p>
              )
            ) : memoryEntries.length > 0 ? (
              // Recent entries
              <ul className="space-y-1.5">
                {memoryEntries.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-1.5 px-1">
                    <Brain className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {entry.content}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
                <Brain className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">
                  No memories yet. The agent will save memories as you chat.
                </p>
              </div>
            )}
          </ScrollArea>
        </div>

        <ResizeHandle onDragStart={handleDragStart(1)} onDrag={handleResize(1)} />

        {/* Scheduled Tasks Section */}
        <div
          className="flex flex-col min-h-0"
          style={{ flex: `${fractions[2]} 1 0%` }}
        >
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scheduled Tasks
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => navigate(`/cron?create=${workspace.id}`)}
              title="New scheduled task"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-3 pb-1">
            {cronJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                No scheduled tasks.
              </p>
            ) : (
              <ul className="space-y-1">
                {cronJobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      onClick={() => navigate("/cron")}
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate flex-1">{job.name}</span>
                      <Badge
                        variant={job.enabled ? "default" : "secondary"}
                        className="text-[10px] px-1 py-0"
                      >
                        {job.enabled ? "Active" : "Off"}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Memory Edit Dialog */}
      <Dialog open={memoryEditOpen} onOpenChange={setMemoryEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
          </DialogHeader>
          <Textarea
            value={memoryDraft}
            onChange={(e) => setMemoryDraft(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemoryEditOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMemorySave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
            autoFocus
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={!renameDraft.trim() || renameDraft === renameTarget?.name}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete File Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-medium text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
