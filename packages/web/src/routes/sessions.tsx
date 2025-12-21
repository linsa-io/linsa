import { useState, useEffect, useCallback } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import {
  Search,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Trash2,
  Clock,
  Globe,
} from "lucide-react"
import type { BrowserSession, BrowserSessionTab } from "@/db/schema"

export const Route = createFileRoute("/sessions")({
  component: BrowserSessionsPage,
  ssr: false,
})

interface SessionWithTabs extends BrowserSession {
  tabs?: BrowserSessionTab[]
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function SessionCard({
  session,
  onToggleFavorite,
  onDelete,
}: {
  session: SessionWithTabs
  onToggleFavorite: (id: string, isFavorite: boolean) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [tabs, setTabs] = useState<BrowserSessionTab[]>([])
  const [loading, setLoading] = useState(false)

  const loadTabs = useCallback(async () => {
    if (tabs.length > 0) return

    setLoading(true)
    try {
      const res = await fetch(`/api/browser-sessions/${session.id}`)
      if (res.ok) {
        const data = await res.json()
        setTabs(data.tabs || [])
      }
    } catch (error) {
      console.error("Failed to load tabs:", error)
    } finally {
      setLoading(false)
    }
  }, [session.id, tabs.length])

  const handleExpand = () => {
    if (!expanded) {
      loadTabs()
    }
    setExpanded(!expanded)
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={handleExpand}
      >
        <button
          type="button"
          className="p-1 text-zinc-500 hover:text-zinc-300"
          onClick={(e) => {
            e.stopPropagation()
            handleExpand()
          }}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {session.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
            <Clock className="w-3 h-3" />
            <span>{formatDate(session.captured_at)}</span>
            <span className="text-zinc-600">|</span>
            <Globe className="w-3 h-3" />
            <span>{session.browser}</span>
            <span className="text-zinc-600">|</span>
            <span>{session.tab_count} tabs</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(session.id, !session.is_favorite)
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            session.is_favorite
              ? "text-yellow-400 hover:text-yellow-300"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
          title={session.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className="w-4 h-4" fill={session.is_favorite ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm("Delete this session?")) {
              onDelete(session.id)
            }
          }}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 transition-colors"
          title="Delete session"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading tabs...</p>
          ) : tabs.length === 0 ? (
            <p className="text-sm text-zinc-500">No tabs found</p>
          ) : (
            <ul className="space-y-1">
              {tabs.map((tab, idx) => (
                <li key={tab.id} className="flex items-start gap-2">
                  <span className="text-xs text-zinc-600 font-mono w-5 text-right shrink-0 pt-1">
                    {idx + 1}
                  </span>
                  <a
                    href={tab.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 group py-1 px-2 -mx-2 rounded hover:bg-zinc-800/50 transition-colors"
                  >
                    <p className="text-sm text-zinc-300 truncate group-hover:text-white">
                      {tab.title || tab.url}
                    </p>
                    <p className="text-xs text-zinc-600 truncate">
                      {getDomain(tab.url)}
                    </p>
                  </a>
                  <a
                    href={tab.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-600 hover:text-zinc-400 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function BrowserSessionsPage() {
  const { data: session, isPending: authPending } = authClient.useSession()
  const [sessions, setSessions] = useState<SessionWithTabs[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(
    async (page = 1, searchQuery = "") => {
      setLoading(true)
      try {
        const body = {
          action: "list" as const,
          page,
          limit: pagination.limit,
          search: searchQuery || undefined,
        }

        const res = await fetch("/api/browser-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          const data = await res.json()
          setSessions(data.sessions || [])
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error)
      } finally {
        setLoading(false)
      }
    },
    [pagination.limit],
  )

  useEffect(() => {
    if (session?.user) {
      fetchSessions(1, search)
    }
  }, [session?.user, fetchSessions, search])

  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      const res = await fetch(`/api/browser-sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: isFavorite }),
      })

      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, is_favorite: isFavorite } : s)),
        )
      }
    } catch (error) {
      console.error("Failed to update favorite:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/browser-sessions/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        setPagination((prev) => ({ ...prev, total: prev.total - 1 }))
      }
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }

  if (authPending) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Sign in to view your browser sessions</p>
          <Link
            to="/login"
            className="inline-block px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  // Group sessions by date
  const sessionsByDate = sessions.reduce(
    (acc, s) => {
      const date = formatDate(s.captured_at)
      if (!acc[date]) acc[date] = []
      acc[date].push(s)
      return acc
    },
    {} as Record<string, SessionWithTabs[]>,
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Browser Sessions</h1>
          <p className="text-zinc-500">
            {pagination.total} sessions saved
          </p>
        </header>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
          />
        </div>

        {/* Sessions list */}
        {loading ? (
          <div className="text-center py-12 text-zinc-500">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {search ? `No sessions found for "${search}"` : "No sessions yet"}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(sessionsByDate).map(([date, dateSessions]) => (
              <section key={date}>
                <h2 className="text-sm font-medium text-zinc-400 mb-3">{date}</h2>
                <div className="space-y-2">
                  {dateSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-8">
            <button
              type="button"
              onClick={() => fetchSessions(pagination.page - 1, search)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
            >
              Previous
            </button>
            <span className="px-3 text-sm text-zinc-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchSessions(pagination.page + 1, search)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
