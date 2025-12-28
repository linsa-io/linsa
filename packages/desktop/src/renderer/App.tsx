import { useEffect, useRef, useState, useCallback } from "react"
import { useAccount } from "jazz-tools/react"
import { AppAccount, CodeFolder } from "../features/folders/model/schema"

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface GitRepo {
  name: string
  path: string
  lastModified: number
}

export function App() {
  if (!window.electronAPI) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Electron preload bridge is missing.</p>
      </div>
    )
  }

  const me = useAccount(AppAccount, {
    resolve: { root: { folders: { $each: { $onError: "catch" } } } },
  })

  // Local state for repos (not synced via Jazz)
  const [repos, setRepos] = useState<GitRepo[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [manualPath, setManualPath] = useState("")
  const [pathError, setPathError] = useState<string | null>(null)

  // UI state
  const [showPalette, setShowPalette] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get folders from Jazz (safely handle loading state)
  const folders = me?.root?.folders ?? []
  const folderPaths = [...folders].filter(Boolean).map((f) => f!.path)

  // Filter repos by search
  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.path.toLowerCase().includes(search.toLowerCase())
  )

  // Scan folders for repos
  const scanRepos = useCallback(async () => {
    if (folderPaths.length === 0) {
      setRepos([])
      return
    }
    setIsScanning(true)
    try {
      const found = await window.electronAPI.scanRepos(folderPaths)
      setRepos(found)
    } finally {
      setIsScanning(false)
    }
  }, [folderPaths.join(","), setRepos, setIsScanning])

  // Scan when folders change
  useEffect(() => {
    if (folderPaths.length > 0) {
      scanRepos()
    } else {
      setRepos([])
    }
  }, [folderPaths.join(",")])

  // Add a folder (saves to Jazz)
  const addFolder = useCallback(async () => {
    if (!me?.root?.folders) return

    const path = await window.electronAPI.pickFolder()
    if (!path) return
    if (folderPaths.includes(path)) return

    // Create folder entry and add to Jazz
    const folder = CodeFolder.create({ path, addedAt: Date.now() })
    me.root.folders.$jazz.push(folder)

    setShowPalette(false)
  }, [me?.root?.folders, folderPaths])

  const addManualFolder = useCallback(() => {
    setPathError(null)
    const trimmed = manualPath.trim()
    if (!trimmed) {
      setPathError("Enter a folder path")
      return
    }
    if (folderPaths.includes(trimmed)) {
      setPathError("Already added")
      return
    }
    if (!me?.root?.folders) return

    const folder = CodeFolder.create({ path: trimmed, addedAt: Date.now() })
    me.root.folders.$jazz.push(folder)
    setManualPath("")
  }, [manualPath, folderPaths, me?.root?.folders])

  // Remove a folder (removes from Jazz)
  const removeFolder = useCallback(
    (path: string) => {
      if (!me?.root?.folders) return

      const idx = [...folders].findIndex((f) => f?.path === path)
      if (idx !== -1) {
        me.root.folders.$jazz.splice(idx, 1)
      }
    },
    [folders, me?.root?.folders]
  )

  // Open repo in editor
  const openInEditor = useCallback((repo: GitRepo) => {
    window.electronAPI.openInEditor(repo.path)
    setShowPalette(false)
  }, [])

  // Commands for palette
  const commands: Command[] = [
    { id: "add-folder", label: "Add code folder", shortcut: "A", action: addFolder },
    { id: "refresh", label: "Refresh repos", shortcut: "R", action: scanRepos },
  ]

  // When palette is open with search, show repos as commands
  const paletteItems =
    showPalette && search
      ? filteredRepos.map((repo) => ({
          id: repo.path,
          label: repo.name,
          shortcut: undefined,
          action: () => openInEditor(repo),
        }))
      : commands

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setShowPalette((prev) => !prev)
        setSearch("")
        setSelectedIndex(0)
      }
      if (e.key === "Escape" && showPalette) {
        setShowPalette(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showPalette])

  // Focus input when palette opens
  useEffect(() => {
    if (showPalette && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showPalette])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, paletteItems.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && paletteItems.length > 0) {
      paletteItems[selectedIndex]?.action()
    }
  }

  const timeAgo = (ms: number) => {
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (!me) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
        <p>Loading account...</p>
        <button
          className="secondary"
          style={{ marginTop: 12 }}
          onClick={() => {
            indexedDB.deleteDatabase("cojson")
            localStorage.clear()
            sessionStorage.clear()
            window.location.reload()
          }}
        >
          Reset local session
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Command Palette */}
      {showPalette && (
        <div className="palette-overlay" onClick={() => setShowPalette(false)}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              className="palette-input"
              placeholder="Search repos or type a command..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handlePaletteKeyDown}
            />
            <div className="palette-commands">
              {paletteItems.map((item, index) => (
                <button
                  key={item.id}
                  className={`palette-command ${index === selectedIndex ? "selected" : ""}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd className="palette-shortcut">{item.shortcut}</kbd>}
                </button>
              ))}
              {paletteItems.length === 0 && <div className="palette-empty">No results</div>}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-drag" />
        <h1>Repos</h1>
        <div className="header-right">
          <span className="sync-status sync-connected">Synced</span>
          <button className="header-btn" onClick={() => setShowPalette(true)}>
            <kbd>Cmd+K</kbd>
          </button>
        </div>
      </header>

      <main className="main">
        <section className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Parent folders</p>
              <h2>Where to look for repos</h2>
              <p className="muted">Add one or more parent folders. We’ll scan them deeply for git repos.</p>
            </div>
            <div className="pill">{folderPaths.length} folders</div>
          </div>

          <div className="folder-inputs">
            <div className="input-stack">
              <label className="label">Add by path</label>
              <div className="input-row">
                <input
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="/Users/you/code"
                  className={`text-input ${pathError ? "has-error" : ""}`}
                />
                <button className="primary-btn" onClick={addManualFolder}>
                  Add
                </button>
                <button className="ghost-btn" onClick={addFolder}>
                  Pick from Finder
                </button>
              </div>
              {pathError && <p className="error-text">{pathError}</p>}
            </div>
          </div>

          {folderPaths.length === 0 ? (
            <div className="empty-inline">
              <p>No folders yet. Add at least one to start scanning.</p>
            </div>
          ) : (
            <div className="chip-grid">
              {folderPaths.map((path) => (
                <div key={path} className="chip">
                  <span className="chip-label" title={path}>
                    {path}
                  </span>
                  <button className="chip-remove" onClick={() => removeFolder(path)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="card-footer">
            <button
              className="secondary-btn"
              onClick={scanRepos}
              disabled={isScanning || folderPaths.length === 0}
            >
              {isScanning ? "Scanning..." : "Refresh now"}
            </button>
            <p className="muted">Deep git parsing will be added next.</p>
          </div>
        </section>

        {repos.length === 0 ? (
          <div className="empty-state">
            {folderPaths.length === 0 ? (
              <>
                <h2>No folders configured</h2>
                <p>Add folders where you keep your code to get started.</p>
                <button className="primary-btn" onClick={addFolder}>
                  Add folder
                </button>
              </>
            ) : isScanning ? (
              <>
                <div className="spinner" />
                <p>Scanning for repos...</p>
              </>
            ) : (
              <>
                <h2>No repos found</h2>
                <p>No git repositories found in the configured folders.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="repo-list">
            {repos.map((repo) => (
              <li key={repo.path} className="repo-item">
                <div className="repo-info" onClick={() => openInEditor(repo)}>
                  <span className="repo-name">{repo.name}</span>
                  <span className="repo-path">{repo.path}</span>
                </div>
                <div className="repo-meta">
                  <span className="repo-time">{timeAgo(repo.lastModified)}</span>
                  <div className="repo-actions">
                    <button
                      className="action-btn"
                      onClick={() => window.electronAPI.openInEditor(repo.path)}
                      title="Open in VS Code"
                    >
                      Code
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => window.electronAPI.openInTerminal(repo.path)}
                      title="Open in Terminal"
                    >
                      Term
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => window.electronAPI.showInFolder(repo.path)}
                      title="Show in Finder"
                    >
                      Finder
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
