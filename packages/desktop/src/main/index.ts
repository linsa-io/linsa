import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, stat } from "node:fs/promises";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

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

function resolvePreload() {
  const candidates = [
    join(__dirname, "../preload/index.js"),
    join(__dirname, "../preload/index.cjs"),
    join(__dirname, "../preload/index.mjs"),
  ];

  return candidates.find((path) => existsSync(path));
}

function createWindow() {
  const preloadPath = resolvePreload();
  const webDevUrl =
    process.env.WEB_DEV_URL ??
    process.env.VITE_WEB_DEV_URL ??
    "http://localhost:5625";
  const webProdUrl = process.env.WEB_URL ?? process.env.VITE_WEB_URL;
  const targetUrl = webProdUrl ?? webDevUrl;

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

  mainWindow
    .loadURL(targetUrl)
    .catch(() => mainWindow.loadFile(join(__dirname, "../renderer/index.html")));

  if (!webProdUrl) {
    mainWindow.webContents.openDevTools({ mode: "bottom" });
  }

  return mainWindow;
}

ipcMain.handle("shell:open-external", async (_event, url: string) => {
  if (!url) return;
  await shell.openExternal(url);
});

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

ipcMain.handle("app:get-version", () => app.getVersion());

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
  if (!path) return;
  shell.showItemInFolder(path);
});

ipcMain.handle("shell:show-path", async (_event, path: string) => {
  if (!path) return;
  shell.showItemInFolder(path);
});

ipcMain.handle("shell:open-in-editor", async (_event, path: string) => {
  if (!path) return;
  const { exec } = await import("node:child_process");
  exec(`code "${path}"`);
});

ipcMain.handle("shell:open-in-terminal", async (_event, path: string) => {
  if (!path) return;
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
