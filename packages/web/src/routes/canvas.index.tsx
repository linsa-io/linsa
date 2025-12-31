import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"

import {
  createCanvasProject,
  fetchCanvasList,
} from "@/lib/canvas/client"
import type {
  SerializedCanvas,
  SerializedCanvasSummary,
} from "@/lib/canvas/types"

export const Route = createFileRoute("/canvas/")({
  ssr: false,
  component: CanvasProjectsPage,
})

function summarize(snapshot: SerializedCanvas): SerializedCanvasSummary {
  return {
    canvas: snapshot.canvas,
    previewImage: snapshot.images[0] ?? null,
    imageCount: snapshot.images.length,
  }
}

function CanvasProjectsPage() {
  const [projects, setProjects] = useState<SerializedCanvasSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const navigate = useNavigate()

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCanvasList()
      setProjects(data)
    } catch (err) {
      console.error("[canvas] failed to load projects", err)
      setError("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const handleCreateProject = useCallback(async () => {
    if (creating) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      const snapshot = await createCanvasProject()
      const summary = summarize(snapshot)
      setProjects((prev) => [summary, ...prev])
      navigate({ to: "/canvas/$canvasId", params: { canvasId: snapshot.canvas.id } })
    } catch (err) {
      console.error("[canvas] failed to create project", err)
      setError("Unable to create a new project")
    } finally {
      setCreating(false)
    }
  }, [creating, navigate])

  const showSkeletonGrid = loading && projects.length === 0

  return (
    <div className="min-h-screen bg-[#030611] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">
              Canvas
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              My Projects
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Choose a canvas to continue exploring ideas. Each project preserves
              its own layout, prompts, and styles.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-white/60">
            <button
              type="button"
              className="rounded-full bg-white/90 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40"
              onClick={handleCreateProject}
              disabled={creating}
            >
              {creating ? "Creating" : "New Project"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="flex items-center justify-between rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <span>{error}</span>
            <button
              type="button"
              className="rounded-full border border-red-200/40 px-3 py-1 text-xs uppercase tracking-[0.2em]"
              onClick={() => void loadProjects()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {showSkeletonGrid ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-64 rounded-3xl border border-white/5 bg-white/5/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ProjectsGrid projects={projects} />
        )}

        {!projects.length && !loading ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-white/5/20 px-10 py-12 text-center text-white/70">
            <p className="text-lg font-semibold">You don't have any projects yet.</p>
            <p className="mt-2 text-sm">
              Start a new canvas to begin planning, brainstorming, or designing.
            </p>
            <button
              type="button"
              className="mt-6 rounded-full border border-white/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
              onClick={handleCreateProject}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create your first project"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProjectsGrid({
  projects,
}: {
  projects: SerializedCanvasSummary[]
}) {
  if (!projects.length) {
    return null
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <CanvasProjectCard key={project.canvas.id} project={project} />
      ))}
    </div>
  )
}

function CanvasProjectCard({
  project,
}: {
  project: SerializedCanvasSummary
}) {
  const previewUrl = useMemo(() => {
    const preview = project.previewImage
    if (!preview) {
      return null
    }
    if (preview.imageUrl) {
      return preview.imageUrl
    }
    if (preview.imageData) {
      const mime =
        preview.metadata && typeof preview.metadata.mimeType === "string"
          ? (preview.metadata.mimeType as string)
          : "image/png"
      return `data:${mime};base64,${preview.imageData}`
    }
    return null
  }, [project.previewImage])

  const imageCountLabel = project.imageCount === 1 ? "image" : "images"
  const updatedAt = useMemo(() => {
    const date = new Date(project.canvas.updatedAt)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }, [project.canvas.updatedAt])

  return (
    <Link
      to="/canvas/$canvasId"
      params={{ canvasId: project.canvas.id }}
      className="group relative flex h-64 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl ring-1 ring-white/5 transition hover:-translate-y-1 hover:border-white/30 hover:ring-white/20"
    >
      <div className="relative flex-1 bg-gradient-to-br from-slate-800 via-slate-900 to-black">
        {previewUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${previewUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.3em] text-white/40">
            No preview yet
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
      </div>
      <div className="relative z-10 space-y-1 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
          <span>{updatedAt}</span>
          <span>
            {project.imageCount} {imageCountLabel}
          </span>
        </div>
        <p className="text-lg font-semibold text-white">
          {project.canvas.name}
        </p>
        <p className="text-xs text-white/60">
          Tap to open canvas
        </p>
      </div>
    </Link>
  )
}
