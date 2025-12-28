import { useEffect, useRef, useState, useCallback } from "react"
import { useAtom } from "@reatom/react"
import { atom } from "@reatom/core"

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

// Reatom atoms for state
const foldersAtom = atom<string[]>(() => {
  try {
    const stored = localStorage.getItem("repo-folders")
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}, "folders")

const reposAtom = atom<GitRepo[]>([], "repos")
const isScanningAtom = atom(false, "isScanning")

export function App() {
  // Reatom state
  const [folders, setFolders] = useAtom(foldersAtom)
  const [repos, setRepos] = useAtom(reposAtom)
  const [isScanning, setIsScanning] = useAtom(isScanningAtom)

  // UI state
  const [showPalette, setShowPalette] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Save folders to localStorage
  useEffect(() => {
    localStorage.setItem("repo-folders", JSON.stringify(folders))
  }, [folders])

  // Filter repos by search
  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.path.toLowerCase().includes(search.toLowerCase())
  )

  // Scan folders for repos
  const scanRepos = useCallback(async () => {
    if (folders.length === 0) {
      setRepos([])
      return
    }
    setIsScanning(true)
    try {
      const found = await window.electronAPI.scanRepos(folders)
      setRepos(found)
    } finally {
      setIsScanning(false)
    }
  }, [folders, setRepos, setIsScanning])

  // Initial scan
  useEffect(() => {
    if (folders.length > 0) {
      scanRepos()
    }
  }, [])

  // Add a folder
  const addFolder = useCallback(async () => {
    const path = await window.electronAPI.pickFolder()
    if (!path) return
    if (folders.includes(path)) return
    setFolders([...folders, path])
    setShowPalette(false)
    // Scan after adding
    setTimeout(async () => {
      setIsScanning(true)
      try {
        const found = await window.electronAPI.scanRepos([...folders, path])
        setRepos(found)
      } finally {
        setIsScanning(false)
      }
    }, 100)
  }, [folders, setFolders, setRepos, setIsScanning])

  // Remove a folder
  const removeFolder = useCallback(
    (path: string) => {
      const newFolders = folders.filter((f) => f !== path)
      setFolders(newFolders)
      if (newFolders.length > 0) {
        window.electronAPI.scanRepos(newFolders).then(setRepos)
      } else {
        setRepos([])
      }
    },
    [folders, setFolders, setRepos]
  )

  // Open repo in editor
  const openInEditor = useCallback((repo: GitRepo) => {
    window.electronAPI.openInEditor(repo.path)
    setShowPalette(false)
  }, [])

  // Commands
  const commands: Command[] = [
    { id: "add-folder", label: "Add code folder", shortcut: "A", action: addFolder },
    { id: "refresh", label: "Refresh repos", shortcut: "R", action: scanRepos },
  ]

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

  useEffect(() => {
    if (showPalette && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showPalette])

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

  return (
    <div className="app">
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

      <header className="header">
        <div className="header-drag" />
        <h1>Repos</h1>
        <div className="header-right">
          <span className="sync-status">Local</span>
          <button className="header-btn" onClick={() => setShowPalette(true)}>
            <kbd>Cmd+K</kbd>
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Folders</span>
          <button className="icon-btn" onClick={addFolder} title="Add folder">+</button>
        </div>
        {folders.length === 0 ? (
          <div className="sidebar-empty">
            No folders added.<br />
            <button className="link-btn" onClick={addFolder}>Add a folder</button>
          </div>
        ) : (
          <ul className="folder-list">
            {folders.map((path) => (
              <li key={path} className="folder-item">
                <span className="folder-path" title={path}>{path.split("/").pop()}</span>
                <button className="icon-btn remove" onClick={() => removeFolder(path)} title="Remove">×</button>
              </li>
            ))}
          </ul>
        )}
        <button className="sidebar-refresh" onClick={scanRepos} disabled={isScanning || folders.length === 0}>
          {isScanning ? "Scanning..." : "Refresh"}
        </button>
      </aside>

      <main className="main">
        {repos.length === 0 ? (
          <div className="empty-state">
            {folders.length === 0 ? (
              <>
                <h2>No folders configured</h2>
                <p>Add folders where you keep your code to get started.</p>
                <button className="primary-btn" onClick={addFolder}>Add folder</button>
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
                    <button className="action-btn" onClick={() => window.electronAPI.openInEditor(repo.path)} title="Open in VS Code">Code</button>
                    <button className="action-btn" onClick={() => window.electronAPI.openInTerminal(repo.path)} title="Open in Terminal">Term</button>
                    <button className="action-btn" onClick={() => window.electronAPI.showInFolder(repo.path)} title="Show in Finder">Finder</button>
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
