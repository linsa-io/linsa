# Linsa desktop

Electron shell that mirrors the same structure we use in the `as` project: `electron-vite` bundling the main, preload, and React renderer, plus a small Jazz schema for storing folders locally.

## Running locally

```bash
pnpm install
pnpm --filter @linsa/desktop dev
```

Set a Jazz Cloud key to sync state instead of keeping it only on the device:

```bash
cd packages/desktop
echo "VITE_JAZZ_API_KEY=your_jazz_key" >> .env
# optional: point to a custom peer
# echo "VITE_JAZZ_PEER=ws://localhost:4200" >> .env
```

## What it does

- Uses `electron-vite` to bundle `main`, `preload`, and the React renderer.
- Wraps the renderer with `JazzReactProvider` (storage in IndexedDB) and a simple Jazz schema to keep track of folders you want scanned.
- Opens an OS folder picker (via the preload bridge) to add/remove code folders.
- Scans those folders for git repos and lets you open them in VS Code, Terminal, or Finder.
- Shows the current Jazz sync status so we can expand to syncing folder lists later.
