import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { api, type Workspace } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, Check, Pencil } from "lucide-react";

function basename(p: string): string {
  return p.replace(/\\/g, "/").split("/").filter(Boolean).pop() || p;
}

export function ProjectDropdown() {
  const { workspaces, activeWorkspace, setActiveWorkspace, createWorkspace, fetchWorkspaces } =
    useWorkspaceStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [editProject, setEditProject] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");

  const handleAddProject = async () => {
    if (!addName.trim()) return;
    const ws = await createWorkspace(addName.trim());
    setActiveWorkspace(ws);
    setAddDialogOpen(false);
    setAddName("");
  };

  const openEdit = (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    setEditProject(ws);
    setEditName(ws.name);
  };

  const handleEditSave = async () => {
    if (!editProject || !editName.trim()) return;
    await api.workspaces.update(editProject.id, { name: editName.trim() });
    setEditProject(null);
    fetchWorkspaces();
  };

  const displayName = activeWorkspace
    ? activeWorkspace.name || basename(activeWorkspace.rootPath)
    : "Select project";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-[280px] shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/50">
            <span className="truncate flex-1 text-left">{displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </DropdownMenuItem>
          {workspaces.length > 0 && <DropdownMenuSeparator />}
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setActiveWorkspace(ws)}
              className="group flex items-center gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {ws.name || basename(ws.rootPath)}
                </div>
              </div>
              <Pencil
                className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                onClick={(e) => openEdit(e, ws)}
              />
              {ws.id === activeWorkspace?.id && (
                <Check className="h-3.5 w-3.5 shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Give your project a name to get started.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProject} disabled={!addName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="edit-project-path">Workspace</Label>
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
    </>
  );
}
