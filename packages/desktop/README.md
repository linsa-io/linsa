# Linsa desktop

Electron shell that mirrors the same structure we use in the `as` project: `electron-vite` bundling the main, preload, and React renderer. The window loads the Linsa web app by default (dev URL: `http://localhost:5625`) and falls back to the bundled renderer if the web app cannot be reached.

## Running locally

```bash
pnpm install
pnpm --filter @linsa/web dev
pnpm --filter @linsa/desktop dev
```

By default the Electron shell loads the existing web app. Override the target with `WEB_DEV_URL` or `WEB_URL` when needed.

Set a Jazz Cloud key to sync state instead of keeping it only on the device:

```bash
cd packages/desktop
echo "VITE_JAZZ_API_KEY=your_jazz_key" >> .env
# optional: point to a custom peer
# echo "VITE_JAZZ_PEER=ws://localhost:4200" >> .env
```

### Optional environment

- `WEB_URL` / `WEB_DEV_URL` – where to load the web app from.
- `VITE_JAZZ_API_KEY` / `VITE_JAZZ_PEER` – used by the fallback renderer for sync.

## What it does

- Uses `electron-vite` to bundle `main`, `preload`, and the React renderer.
- Loads the web client first and falls back to the bundled renderer if needed.
- Wraps the renderer with `JazzReactProvider` (storage in IndexedDB) and a simple Jazz schema to keep track of folders you want scanned.
- Opens an OS folder picker (via the preload bridge) to add/remove code folders.
- Scans those folders for git repos and lets you open them in VS Code, Terminal, or Finder.
- Shows the current Jazz sync status so we can expand to syncing folder lists later.
