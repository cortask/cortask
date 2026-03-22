import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { api, type Workspace, type CronJobWithState } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Eye,
  RefreshCw,
  Brain,
  Clock,
  Pencil,
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
}: {
  node: TreeNode;
  workspaceId: string;
  selectedFiles: string[];
  onToggle: (path: string, ctrlKey: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = usePreviewStore((s) => s.open);
  const isSelected = selectedFiles.includes(node.entry.path);

  if (node.entry.type === "dir") {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
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
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded px-1 py-0.5 text-xs cursor-pointer ${
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
  );
}

interface WorkspaceSidebarProps {
  workspace: Workspace;
  selectedFiles: string[];
  onSelectedFilesChange: (files: string[]) => void;
}

export function WorkspaceSidebar({
  workspace,
  selectedFiles,
  onSelectedFilesChange,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();

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

  // Memory
  const [memory, setMemory] = useState<string | null>(null);
  const [memoryEditOpen, setMemoryEditOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");

  useEffect(() => {
    api.workspaces
      .readMemory(workspace.id)
      .then((r) => setMemory(r.content))
      .catch(() => {});
  }, [workspace.id]);

  const handleMemoryEdit = () => {
    setMemoryDraft(memory ?? "");
    setMemoryEditOpen(true);
  };

  const handleMemorySave = async () => {
    await api.workspaces.writeMemory(workspace.id, memoryDraft);
    setMemory(memoryDraft);
    setMemoryEditOpen(false);
  };

  // Cron jobs
  const [cronJobs, setCronJobs] = useState<CronJobWithState[]>([]);

  useEffect(() => {
    api.cron
      .list(workspace.id)
      .then(setCronJobs)
      .catch(() => {});
  }, [workspace.id]);

  return (
    <>
      <div className="flex h-full w-[280px] shrink-0 flex-col border-l bg-background">
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Files Section */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
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
              {tree.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">
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
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Memory Section */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Memory
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={handleMemoryEdit}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              {memory ? (
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap px-1">
                  {memory.slice(0, 200)}
                  {memory.length > 200 ? "..." : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground px-1">
                  No memory saved.
                </p>
              )}
            </section>

            {/* Scheduled Tasks Section */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Scheduled Tasks
                </h3>
              </div>
              {cronJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">
                  No scheduled tasks.
                </p>
              ) : (
                <ul className="space-y-1">
                  {cronJobs.map((job) => (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => navigate("/cron")}
                        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
            </section>
          </div>
        </ScrollArea>
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
    </>
  );
}
