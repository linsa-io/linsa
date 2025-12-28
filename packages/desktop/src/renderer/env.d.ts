import type { DesktopAPI } from "../preload";

declare global {
  interface Window {
    electronAPI: DesktopAPI;
  }
}

export {};
