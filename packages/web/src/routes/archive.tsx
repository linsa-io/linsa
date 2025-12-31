import { useCallback, useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { Archive } from "@/db/schema"
import { Plus, Video, Image, FileText, Lock, Globe } from "lucide-react"

export const Route = createFileRoute("/archive")({
  ssr: false,
  component: ArchivePage,
})

type ArchiveType = "video" | "image" | "text"

function ArchivePage() {
  const [archives, setArchives] = useState<Archive[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)

  const navigate = useNavigate()

  const loadArchives = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/archives")
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setHasAccess(false)
          return
        }
        throw new Error(data.error || "Failed to load archives")
      }

      setArchives(data.archives || [])
      setHasAccess(true)
    } catch (err) {
      console.error("[archive] failed to load archives", err)
      setError("Failed to load archives")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadArchives()
  }, [loadArchives])

  const handleCreateArchive = async (
    title: string,
    type: ArchiveType,
    description?: string
  ) => {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create archive")
      }

      setArchives((prev) => [data.archive, ...prev])
      setShowCreateModal(false)
    } catch (err) {
      console.error("[archive] failed to create archive", err)
      setError(err instanceof Error ? err.message : "Failed to create archive")
    } finally {
      setCreating(false)
    }
  }

  if (!hasAccess) {
    return <UpgradePrompt />
  }

  return (
    <div className="min-h-screen bg-[#030611] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
              Archive
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              My Archives
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Store videos, images, and text privately. Share what you want.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-white/60">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40"
              onClick={() => setShowCreateModal(true)}
              disabled={creating}
            >
              <Plus className="h-4 w-4" />
              New Archive
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <span>{error}</span>
            <button
              type="button"
              className="rounded-full border border-red-200/40 px-3 py-1 text-xs uppercase tracking-[0.2em]"
              onClick={() => void loadArchives()}
            >
              Retry
            </button>
          </div>
        )}

        {loading && archives.length === 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-48 rounded-2xl border border-white/5 bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : archives.length > 0 ? (
          <ArchiveGrid archives={archives} />
        ) : (
          !loading && (
            <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-10 py-12 text-center text-white/70">
              <p className="text-lg font-semibold">No archives yet</p>
              <p className="mt-2 text-sm">
                Create your first archive to start storing content.
              </p>
              <button
                type="button"
                className="mt-6 flex items-center gap-2 mx-auto rounded-full border border-white/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
                onClick={() => setShowCreateModal(true)}
                disabled={creating}
              >
                <Plus className="h-4 w-4" />
                Create your first archive
              </button>
            </div>
          )
        )}
      </div>

      {showCreateModal && (
        <CreateArchiveModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateArchive}
          creating={creating}
        />
      )}
    </div>
  )
}

function ArchiveGrid({ archives }: { archives: Archive[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {archives.map((archive) => (
        <ArchiveCard key={archive.id} archive={archive} />
      ))}
    </div>
  )
}

function ArchiveCard({ archive }: { archive: Archive }) {
  const TypeIcon = {
    video: Video,
    image: Image,
    text: FileText,
  }[archive.type] || FileText

  const createdAt = new Date(archive.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

  return (
    <Link
      to="/archive/$archiveId"
      params={{ archiveId: archive.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl transition hover:-translate-y-1 hover:border-white/30"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
          <TypeIcon className="h-6 w-6 text-white/70" />
        </div>
        <div className="flex items-center gap-1 text-white/50">
          {archive.is_public ? (
            <Globe className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="font-semibold text-white">{archive.title}</h3>
        {archive.description && (
          <p className="mt-1 text-sm text-white/60 line-clamp-2">
            {archive.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
        <span className="uppercase tracking-wider">{archive.type}</span>
        <span>{createdAt}</span>
      </div>
    </Link>
  )
}

function CreateArchiveModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void
  onCreate: (title: string, type: ArchiveType, description?: string) => void
  creating: boolean
}) {
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ArchiveType>("video")
  const [description, setDescription] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onCreate(title.trim(), type, description.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f1c] p-6">
        <h2 className="text-xl font-semibold text-white">Create Archive</h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
              placeholder="My Archive"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Type</label>
            <div className="flex gap-2">
              {(["video", "image", "text"] as ArchiveType[]).map((t) => {
                const Icon = { video: Video, image: Image, text: FileText }[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm capitalize transition ${
                      type === t
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/30 focus:outline-none resize-none"
              placeholder="What's this archive about?"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="flex-1 rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UpgradePrompt() {
  return (
    <div className="min-h-screen bg-[#030611] px-6 py-10 text-white flex items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-white/70" />
        </div>
        <h1 className="text-2xl font-semibold">Archive Access Required</h1>
        <p className="mt-3 text-white/60">
          Archive is a premium feature for storing and sharing your content.
          Upgrade to access video, image, and text storage.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/"
            className="rounded-full border border-white/20 px-6 py-3 text-sm hover:bg-white/5"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
