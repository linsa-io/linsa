import { contextBridge, ipcRenderer } from "electron";

export interface GitRepo {
  name: string;
  path: string;
  lastModified: number;
}

contextBridge.exposeInMainWorld("electronAPI", {
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder") as Promise<string | null>,
  scanRepos: (folders: string[]) => ipcRenderer.invoke("repos:scan", folders) as Promise<GitRepo[]>,
  showInFolder: (path: string) => ipcRenderer.invoke("shell:show-in-folder", path),
  openInEditor: (path: string) => ipcRenderer.invoke("shell:open-in-editor", path),
  openInTerminal: (path: string) => ipcRenderer.invoke("shell:open-in-terminal", path),
});
