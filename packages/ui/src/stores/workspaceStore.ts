import { create } from "zustand";
import { api, type Workspace } from "@/lib/api";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string, rootPath?: string) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  reorderWorkspaces: (orderedIds: string[]) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  loading: false,

  fetchWorkspaces: async () => {
    set({ loading: true });
    try {
      const workspaces = await api.workspaces.list();
      set({ workspaces, loading: false });

      // Auto-select first workspace if none active
      if (!get().activeWorkspace && workspaces.length > 0) {
        const opened = await api.workspaces.open(workspaces[0].id);
        set({ activeWorkspace: opened });
      }
    } catch {
      set({ loading: false });
    }
  },

  setActiveWorkspace: async (workspace) => {
    await api.workspaces.open(workspace.id);
    set({ activeWorkspace: workspace });
  },

  createWorkspace: async (name, rootPath) => {
    const workspace = await api.workspaces.create(name, rootPath || undefined);
    set((s) => ({ workspaces: [workspace, ...s.workspaces] }));
    return workspace;
  },

  deleteWorkspace: async (id) => {
    await api.workspaces.delete(id);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspace:
        s.activeWorkspace?.id === id ? null : s.activeWorkspace,
    }));
  },

  reorderWorkspaces: async (orderedIds) => {
    // Optimistically reorder in local state
    set((s) => {
      const byId = new Map(s.workspaces.map((w) => [w.id, w]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter(Boolean) as Workspace[];
      return { workspaces: reordered };
    });
    await api.workspaces.reorder(orderedIds);
  },
}));
