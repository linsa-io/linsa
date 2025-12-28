import { contextBridge, ipcRenderer } from "electron";

export interface GitRepo {
  name: string;
  path: string;
  lastModified: number;
}

export interface DesktopAPI {
  openExternal: (url: string) => Promise<void>;
  showPath: (path: string) => Promise<void>;
  showInFolder: (path: string) => Promise<void>;
  pickFolder: () => Promise<string | null>;
  getVersion: () => Promise<string>;
  scanRepos: (folders: string[]) => Promise<GitRepo[]>;
  openInEditor: (path: string) => Promise<void>;
  openInTerminal: (path: string) => Promise<void>;
}

contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  showPath: (path: string) => ipcRenderer.invoke("shell:show-path", path),
  showInFolder: (path: string) => ipcRenderer.invoke("shell:show-in-folder", path),
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder") as Promise<string | null>,
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  scanRepos: (folders: string[]) => ipcRenderer.invoke("repos:scan", folders) as Promise<GitRepo[]>,
  openInEditor: (path: string) => ipcRenderer.invoke("shell:open-in-editor", path),
  openInTerminal: (path: string) => ipcRenderer.invoke("shell:open-in-terminal", path),
} satisfies DesktopAPI);
