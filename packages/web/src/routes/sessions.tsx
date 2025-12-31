import { useState, type FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useAccount } from "jazz-tools/react"
import {
  ViewerAccount,
  BrowserSession,
  BrowserSessionList,
  type BrowserTab,
} from "@/lib/jazz/schema"
import {
  Layers,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Upload,
  Clock,
  Tag,
  Search,
} from "lucide-react"
import { JazzProvider } from "@/lib/jazz/provider"

export const Route = createFileRoute("/sessions")({
  component: SessionsPageWrapper,
  ssr: false,
})

function SessionsPageWrapper() {
  return (
    <JazzProvider>
      <SessionsPage />
    </JazzProvider>
  )
}

function SessionsPage() {
  const { data: session, isPending: authPending } = authClient.useSession()
  const me = useAccount(ViewerAccount)

  const [isAdding, setIsAdding] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  // New session form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newBrowser, setNewBrowser] = useState<"safari" | "chrome" | "firefox" | "arc" | "other">("safari")
  const [newTags, setNewTags] = useState("")
  const [newTabs, setNewTabs] = useState<BrowserTab[]>([])
  const [tabUrl, setTabUrl] = useState("")
  const [tabTitle, setTabTitle] = useState("")

  // Import state
  const [importJson, setImportJson] = useState("")

  if (authPending) {
    return <div className="min-h-screen" />
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <div className="text-center space-y-4">
          <p className="text-slate-400">Please sign in to save browser sessions</p>
          <a
            href="/auth"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  const root = me.$isLoaded ? me.root : null

  if (!me.$isLoaded || !root?.$isLoaded) {
    return <div className="min-h-screen" />
  }

  // Initialize browserSessions if not present
  if (!root.browserSessions) {
    root.$jazz.set("browserSessions", BrowserSessionList.create([]))
  }

  const sessionsList = root.browserSessions?.$isLoaded ? root.browserSessions : null
  const allSessions = sessionsList?.$isLoaded ? [...sessionsList] : []

  // Filter sessions by search query
  const sessions = searchQuery
    ? allSessions.filter((s) => {
        const q = searchQuery.toLowerCase()
        return (
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.tabs?.some(
            (tab) =>
              tab.title?.toLowerCase().includes(q) || tab.url?.toLowerCase().includes(q)
          )
        )
      })
    : allSessions

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSessions(newExpanded)
  }

  const handleAddTab = () => {
    if (!tabUrl.trim()) return
    setNewTabs([
      ...newTabs,
      { url: tabUrl.trim(), title: tabTitle.trim() || tabUrl.trim(), favicon: null },
    ])
    setTabUrl("")
    setTabTitle("")
  }

  const handleRemoveTab = (index: number) => {
    setNewTabs(newTabs.filter((_, i) => i !== index))
  }

  const handleSaveSession = (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newTabs.length === 0 || !root?.browserSessions?.$isLoaded) return

    const newSession = BrowserSession.create({
      name: newName.trim(),
      description: newDescription.trim() || null,
      tabs: newTabs,
      browserType: newBrowser,
      createdAt: Date.now(),
      tags: newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })

    root.browserSessions.$jazz.push(newSession)

    // Reset form
    setNewName("")
    setNewDescription("")
    setNewBrowser("safari")
    setNewTags("")
    setNewTabs([])
    setIsAdding(false)
  }

  const handleImport = (e: FormEvent) => {
    e.preventDefault()
    if (!importJson.trim() || !root?.browserSessions?.$isLoaded) return

    try {
      const data = JSON.parse(importJson)
      let tabs: BrowserTab[] = []

      // Support both array format and object with tabs property
      if (Array.isArray(data)) {
        tabs = data.map((item: { title?: string; url: string }) => ({
          title: item.title || item.url,
          url: item.url,
          favicon: null,
        }))
      } else if (data.tabs && Array.isArray(data.tabs)) {
        tabs = data.tabs.map((item: { title?: string; url: string }) => ({
          title: item.title || item.url,
          url: item.url,
          favicon: null,
        }))
      }

      if (tabs.length === 0) {
        alert("No valid tabs found in JSON")
        return
      }

      const sessionName = data.name || `Imported ${new Date().toLocaleDateString()}`

      const newSession = BrowserSession.create({
        name: sessionName,
        description: data.description || null,
        tabs,
        browserType: data.browserType || "other",
        createdAt: Date.now(),
        tags: data.tags || [],
      })

      root.browserSessions.$jazz.push(newSession)

      setImportJson("")
      setIsImporting(false)
    } catch {
      alert("Invalid JSON format")
    }
  }

  const handleDeleteSession = (index: number) => {
    if (!root?.browserSessions?.$isLoaded) return
    root.browserSessions.$jazz.splice(index, 1)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-semibold">Browser Sessions</h1>
            <span className="text-sm text-white/50">({allSessions.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImporting(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions, tabs, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Import Modal */}
        {isImporting && (
          <form
            onSubmit={handleImport}
            className="mb-6 p-4 bg-[#0c0f18] border border-white/10 rounded-xl space-y-4"
          >
            <h3 className="text-lg font-medium">Import Session from JSON</h3>
            <p className="text-sm text-white/60">
              Paste JSON with format: {`[{title, url}, ...]`} or {`{name, tabs: [{title, url}, ...]}`}
            </p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"title": "Example", "url": "https://example.com"}]'
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsImporting(false)
                  setImportJson("")
                }}
                className="px-4 py-2 rounded-lg text-sm text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
              >
                Import
              </button>
            </div>
          </form>
        )}

        {/* Add Session Form */}
        {isAdding && (
          <form
            onSubmit={handleSaveSession}
            className="mb-6 p-4 bg-[#0c0f18] border border-white/10 rounded-xl space-y-4"
          >
            <h3 className="text-lg font-medium">New Browser Session</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">Session Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Research tabs"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Browser</label>
                <select
                  value={newBrowser}
                  onChange={(e) =>
                    setNewBrowser(e.target.value as "safari" | "chrome" | "firefox" | "arc" | "other")
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="safari">Safari</option>
                  <option value="chrome">Chrome</option>
                  <option value="firefox">Firefox</option>
                  <option value="arc">Arc</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">Description (optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Tabs for my research project"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">Tags (comma-separated)</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="work, research, important"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Add Tab */}
            <div className="space-y-2">
              <label className="text-sm text-white/70">Add Tabs</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={tabUrl}
                  onChange={(e) => setTabUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={tabTitle}
                  onChange={(e) => setTabTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddTab}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs List */}
            {newTabs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-white/70">
                  {newTabs.length} tab{newTabs.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {newTabs.map((tab, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      <span className="flex-1 text-sm truncate">{tab.title}</span>
                      <span className="text-xs text-white/50 truncate max-w-[200px]">{tab.url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTab(i)}
                        className="p-1 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  setNewName("")
                  setNewDescription("")
                  setNewTags("")
                  setNewTabs([])
                }}
                className="px-4 py-2 rounded-lg text-sm text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={newTabs.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Session
              </button>
            </div>
          </form>
        )}

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{searchQuery ? `No sessions found for "${searchQuery}"` : "No saved sessions yet"}</p>
            <p className="text-sm mt-1">
              {searchQuery ? "Try a different search term" : "Save your browser tabs to access them anywhere"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((item, index) => {
                const isExpanded = expandedSessions.has(index)
                const tabCount = item.tabs?.length || 0

                return (
                  <div
                    key={index}
                    className="bg-[#0c0f18] border border-white/5 rounded-xl overflow-hidden"
                  >
                    {/* Session Header */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleExpanded(index)}
                    >
                      <button type="button" className="text-white/50">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white truncate">{item.name}</p>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60">
                            {item.browserType}
                          </span>
                          <span className="text-xs text-white/50">
                            {tabCount} tab{tabCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-white/50 truncate mt-1">{item.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </span>
                          {item.tags && item.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {item.tags.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(index)
                        }}
                        className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Expanded Tabs */}
                    {isExpanded && item.tabs && (
                      <div className="border-t border-white/5 p-4 space-y-2">
                        {item.tabs.map((tab, tabIndex) => (
                          <div
                            key={tabIndex}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{tab.title}</p>
                              <p className="text-xs text-white/40 truncate">{tab.url}</p>
                            </div>
                            <a
                              href={tab.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => {
                              item.tabs?.forEach((tab) => {
                                window.open(tab.url, "_blank")
                              })
                            }}
                            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
                          >
                            Open all {tabCount} tabs
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
