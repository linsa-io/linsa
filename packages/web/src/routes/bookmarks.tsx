import { useState, useEffect, type FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { Bookmark, Plus, Trash2, ExternalLink, AlertCircle } from "lucide-react"

type BookmarkData = {
  id: string
  url: string
  title: string | null
  description: string | null
  tags: string | null
  created_at: string
}

export const Route = createFileRoute("/bookmarks")({
  component: BookmarksPage,
  ssr: false,
})

function BookmarksPage() {
  const { data: session, isPending: authPending } = authClient.useSession()

  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newTags, setNewTags] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null)

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks-list", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setBookmarks(data.bookmarks || [])
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchBookmarks()
    } else {
      setLoading(false)
    }
  }, [session?.user])

  // Check for duplicate URL as user types
  useEffect(() => {
    if (!newUrl.trim()) {
      setDuplicateUrl(null)
      return
    }

    const normalizedInput = normalizeUrl(newUrl.trim())
    const existing = bookmarks.find(
      (b) => normalizeUrl(b.url) === normalizedInput
    )

    if (existing) {
      setDuplicateUrl(existing.title || existing.url)
    } else {
      setDuplicateUrl(null)
    }
  }, [newUrl, bookmarks])

  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
      return parsed.href.toLowerCase().replace(/\/$/, "")
    } catch {
      return url.toLowerCase().trim()
    }
  }

  const handleAddBookmark = async (e: FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim() || duplicateUrl) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/bookmarks-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newTitle.trim() || null,
          tags: newTags.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to add bookmark")
      } else {
        setNewUrl("")
        setNewTitle("")
        setNewTags("")
        setIsAdding(false)
        fetchBookmarks()
      }
    } catch {
      setError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookmarks-delete?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        setBookmarks(bookmarks.filter((b) => b.id !== id))
      }
    } catch {
      // Ignore
    }
  }

  if (authPending) {
    return <div className="min-h-screen bg-black" />
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-center space-y-4">
          <p className="text-slate-400">Please sign in to view bookmarks</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-semibold">Bookmarks</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Bookmark
          </button>
        </div>

        {isAdding && (
          <form
            onSubmit={handleAddBookmark}
            className="mb-6 p-4 bg-[#0c0f18] border border-white/10 rounded-xl space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm text-white/70">URL</label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {duplicateUrl && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Already bookmarked: {duplicateUrl}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">Title (optional)</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Page title"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">Tags (optional)</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="comma, separated, tags"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !!duplicateUrl}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Adding..." : "Add Bookmark"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  setNewUrl("")
                  setNewTitle("")
                  setNewTags("")
                  setError(null)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No bookmarks yet</p>
            <p className="text-sm mt-1">Click "Add Bookmark" to save your first one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="p-4 bg-[#0c0f18] border border-white/10 rounded-xl flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-teal-400 font-medium flex items-center gap-2 group"
                  >
                    <span className="truncate">
                      {bookmark.title || bookmark.url}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                  {bookmark.title && (
                    <p className="text-sm text-white/50 truncate mt-0.5">
                      {bookmark.url}
                    </p>
                  )}
                  {bookmark.tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {bookmark.tags.split(",").map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-xs bg-white/5 rounded-full text-white/60"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(bookmark.id)}
                  className="p-2 text-white/40 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
