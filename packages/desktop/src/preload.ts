import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cortask", {
  platform: process.platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:version"),
  browseFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke("browse-folder");
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: unknown, maximized: boolean) => callback(maximized);
      ipcRenderer.on("window:maximizeChanged", listener);
      return () => ipcRenderer.removeListener("window:maximizeChanged", listener);
    },
  },
  shell: {
    openPath: (filePath: string): Promise<void> =>
      ipcRenderer.invoke("shell:open-path", filePath),
    showInFolder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke("shell:show-in-folder", filePath),
  },
  updater: {
    check: (): Promise<unknown> => ipcRenderer.invoke("updater:check"),
    download: (): Promise<void> => ipcRenderer.invoke("updater:download"),
    install: (): Promise<void> => ipcRenderer.invoke("updater:install"),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: unknown, status: unknown) => callback(status);
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
  },
});
