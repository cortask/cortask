import { create } from "zustand";

export interface PreviewItem {
  /** Display title (filename or artifact title) */
  title: string;
  /** URL to fetch the raw content from */
  url: string;
  /** File extension or artifact type for choosing the renderer */
  type: string;
}

interface PreviewState {
  item: PreviewItem | null;
  open: (item: PreviewItem) => void;
  close: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}));
