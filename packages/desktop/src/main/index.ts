import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, stat } from "node:fs/promises";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GitRepo {
  name: string;
  path: string;
  lastModified: number;
}

async function findGitRepos(dir: string, maxDepth = 4): Promise<GitRepo[]> {
  const repos: GitRepo[] = [];

  async function scan(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") && entry.name !== ".git") continue;
        if (entry.name === "node_modules") continue;

        const fullPath = join(currentPath, entry.name);

        if (entry.name === ".git") {
          const repoPath = currentPath;
          const stats = await stat(fullPath);
          repos.push({
            name: basename(repoPath),
            path: repoPath,
            lastModified: stats.mtimeMs,
          });
          return;
        }

        await scan(fullPath, depth + 1);
      }
    } catch {
      // Permission denied or other error - skip
    }
  }

  await scan(dir, 0);
  return repos;
}

function createWindow() {
  const preloadJs = join(__dirname, "../preload/index.js");
  const preloadCjs = join(__dirname, "../preload/index.cjs");
  const preloadMjs = join(__dirname, "../preload/index.mjs");
  const preloadPath = [preloadJs, preloadCjs, preloadMjs].find((p) =>
    existsSync(p),
  );

  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

ipcMain.handle("dialog:pick-folder", async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: "Select code folder",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("repos:scan", async (_event, folders: string[]): Promise<GitRepo[]> => {
  const allRepos: GitRepo[] = [];

  for (const folder of folders) {
    const repos = await findGitRepos(folder);
    allRepos.push(...repos);
  }

  allRepos.sort((a, b) => b.lastModified - a.lastModified);

  const seen = new Set<string>();
  return allRepos.filter((repo) => {
    if (seen.has(repo.path)) return false;
    seen.add(repo.path);
    return true;
  });
});

ipcMain.handle("shell:show-in-folder", async (_event, path: string) => {
  shell.showItemInFolder(path);
});

ipcMain.handle("shell:open-in-editor", async (_event, path: string) => {
  const { exec } = await import("node:child_process");
  exec(`code "${path}"`);
});

ipcMain.handle("shell:open-in-terminal", async (_event, path: string) => {
  const { exec } = await import("node:child_process");
  if (process.platform === "darwin") {
    exec(`open -a Terminal "${path}"`);
  } else if (process.platform === "win32") {
    exec(`start cmd /K "cd /d ${path}"`);
  } else {
    exec(`x-terminal-emulator --working-directory="${path}"`);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
