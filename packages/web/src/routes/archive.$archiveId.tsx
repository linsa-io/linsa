import { useCallback, useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { Archive } from "@/db/schema"
import {
  ArrowLeft,
  Video,
  Image,
  FileText,
  Lock,
  Globe,
  Trash2,
  Edit3,
  Share2,
} from "lucide-react"

export const Route = createFileRoute("/archive/$archiveId")({
  ssr: false,
  component: ArchiveDetailPage,
})

function ArchiveDetailPage() {
  const { archiveId } = Route.useParams()
  const navigate = useNavigate()

  const [archive, setArchive] = useState<Archive | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const loadArchive = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/archives/${archiveId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load archive")
      }

      setArchive(data.archive)
    } catch (err) {
      console.error("[archive] failed to load archive", err)
      setError(err instanceof Error ? err.message : "Failed to load archive")
    } finally {
      setLoading(false)
    }
  }, [archiveId])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/archives/${archiveId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete archive")
      }

      navigate({ to: "/archive" })
    } catch (err) {
      console.error("[archive] failed to delete", err)
      setError(err instanceof Error ? err.message : "Failed to delete archive")
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleToggleVisibility = async () => {
    if (!archive) return

    try {
      const response = await fetch(`/api/archives/${archiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !archive.is_public }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update visibility")
      }

      setArchive(data.archive)
    } catch (err) {
      console.error("[archive] failed to toggle visibility", err)
      setError(err instanceof Error ? err.message : "Failed to update")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030611] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
          <div className="mt-8 h-64 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !archive) {
    return (
      <div className="min-h-screen bg-[#030611] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/archive"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Archives
          </Link>
          <div className="mt-8 rounded-2xl border border-red-400/40 bg-red-500/10 p-8 text-center">
            <p className="text-red-100">{error || "Archive not found"}</p>
            <button
              onClick={() => void loadArchive()}
              className="mt-4 rounded-full border border-red-200/40 px-4 py-2 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const TypeIcon = {
    video: Video,
    image: Image,
    text: FileText,
  }[archive.type] || FileText

  return (
    <div className="min-h-screen bg-[#030611] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/archive"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Archives
        </Link>

        <div className="mt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
                <TypeIcon className="h-7 w-7 text-white/70" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold">{archive.title}</h1>
                <div className="mt-2 flex items-center gap-3 text-sm text-white/60">
                  <span className="uppercase tracking-wider">{archive.type}</span>
                  <span>•</span>
                  <span>
                    {new Date(archive.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleVisibility}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                  archive.is_public
                    ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {archive.is_public ? (
                  <>
                    <Globe className="h-4 w-4" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Private
                  </>
                )}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          {archive.description && (
            <p className="mt-6 text-white/70">{archive.description}</p>
          )}

          {/* Content area */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8">
            {archive.type === "video" && (
              <VideoContent archive={archive} />
            )}
            {archive.type === "image" && (
              <ImageContent archive={archive} />
            )}
            {archive.type === "text" && (
              <TextContent archive={archive} />
            )}
          </div>

          {/* Metadata */}
          {archive.file_size_bytes && archive.file_size_bytes > 0 && (
            <div className="mt-4 text-sm text-white/50">
              Size: {formatBytes(archive.file_size_bytes)}
              {archive.duration_seconds && (
                <span className="ml-4">
                  Duration: {formatDuration(archive.duration_seconds)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0f1c] p-6 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 text-xl font-semibold">Delete Archive?</h2>
            <p className="mt-2 text-white/60">
              This action cannot be undone. All content will be permanently
              deleted.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoContent({ archive }: { archive: Archive }) {
  if (!archive.content_url) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/50">
        <Video className="h-16 w-16 mb-4" />
        <p>No video uploaded yet</p>
        <button className="mt-4 rounded-full border border-white/20 px-6 py-2 text-sm hover:bg-white/5">
          Upload Video
        </button>
      </div>
    )
  }

  return (
    <video
      src={archive.content_url}
      controls
      className="w-full rounded-xl"
      poster={archive.thumbnail_url ?? undefined}
    />
  )
}

function ImageContent({ archive }: { archive: Archive }) {
  if (!archive.content_url) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/50">
        <Image className="h-16 w-16 mb-4" />
        <p>No image uploaded yet</p>
        <button className="mt-4 rounded-full border border-white/20 px-6 py-2 text-sm hover:bg-white/5">
          Upload Image
        </button>
      </div>
    )
  }

  return (
    <img
      src={archive.content_url}
      alt={archive.title}
      className="w-full rounded-xl"
    />
  )
}

function TextContent({ archive }: { archive: Archive }) {
  if (!archive.content_text) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/50">
        <FileText className="h-16 w-16 mb-4" />
        <p>No text content yet</p>
        <button className="mt-4 rounded-full border border-white/20 px-6 py-2 text-sm hover:bg-white/5">
          Add Content
        </button>
      </div>
    )
  }

  return (
    <div className="prose prose-invert max-w-none">
      <pre className="whitespace-pre-wrap font-sans text-white/80">
        {archive.content_text}
      </pre>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
