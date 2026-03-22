import { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain, shell } from "electron";
import path from "node:path";
import { startBackend, stopBackend } from "./backend.js";
import { initUpdater } from "./updater.js";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Ensure only one instance runs at a time.
// If a second instance is launched (e.g. user clicks the app while it's in tray),
// focus the existing window instead of starting a duplicate backend.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function resolveDataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

function resolveUiDistPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ui");
  }
  return path.resolve(__dirname, "../../ui/dist");
}

function resolveIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png");
  }
  return path.resolve(__dirname, "../build/icon.png");
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Cortask",
    backgroundColor: "#09090b",
    frame: false,
    titleBarStyle: "hidden",
    icon: resolveIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove default application menu
  Menu.setApplicationMenu(null);

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximizeChanged", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximizeChanged", false);
  });

  mainWindow.on("close", (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = resolveIconPath();
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Cortask");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Cortask",
      click: () => mainWindow?.show(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        tray = null;
        stopBackend();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

async function findAvailablePort(
  dataDir: string,
  uiDistPath: string,
  startPort: number = 3777,
  maxAttempts: number = 10
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      await startBackend({
        dataDir,
        uiDistPath,
        port,
      });
      if (attempt > 0) {
        console.log(`[desktop] Port ${startPort} was in use, using port ${port} instead`);
      }
      return port;
    } catch (err: any) {
      const code = err.code ?? err.cause?.code;
      if (code === 'EADDRINUSE' || String(err.message).includes('EADDRINUSE') || String(err.message).includes('already in use')) {
        console.log(`[desktop] Port ${port} is in use, trying next port...`);
        continue;
      }
      // If it's not a port conflict, rethrow
      throw err;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts (tried ${startPort}-${startPort + maxAttempts - 1})`);
}

app.whenReady().then(async () => {
  // Window control IPC handlers
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow?.close());
  ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle("app:version", () => app.getVersion());

  // Set up IPC handlers
  ipcMain.handle("browse-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Workspace Folder",
    });
    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle("shell:open-path", async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
    } catch (err) {
      console.error("Failed to open path:", err);
    }
  });

  ipcMain.handle("shell:show-in-folder", async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
    } catch (err) {
      console.error("Failed to show in folder:", err);
    }
  });

  try {
    console.log("Starting Cortask backend...");
    const port = await findAvailablePort(
      resolveDataDir(),
      resolveUiDistPath()
    );
    console.log(`Backend running on port ${port}`);

    createTray();
    createWindow(port);

    if (app.isPackaged) {
      initUpdater(mainWindow!);
    }
  } catch (err) {
    console.error("Failed to start:", err);
    dialog.showErrorBox(
      "Cortask",
      `Failed to start backend: ${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    stopBackend();
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  tray = null;
  stopBackend();
});
