interface GitRepo {
  name: string;
  path: string;
  lastModified: number;
}

interface ElectronAPI {
  pickFolder: () => Promise<string | null>;
  scanRepos: (folders: string[]) => Promise<GitRepo[]>;
  showInFolder: (path: string) => Promise<void>;
  openInEditor: (path: string) => Promise<void>;
  openInTerminal: (path: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
