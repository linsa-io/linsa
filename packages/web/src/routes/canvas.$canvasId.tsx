import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

import { BladeCanvasExperience } from "@/features/canvas/BladeCanvasExperience"
import { fetchCanvasSnapshot } from "@/lib/canvas/client"
import type { SerializedCanvas } from "@/lib/canvas/types"

export const Route = createFileRoute("/canvas/$canvasId")({
  ssr: false,
  component: CanvasDetailPage,
})

function CanvasDetailPage() {
  const { canvasId } = Route.useParams()
  const [snapshot, setSnapshot] = useState<SerializedCanvas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCanvasSnapshot(canvasId)
        if (active) {
          setSnapshot(data)
        }
      } catch (err) {
        console.error("[canvas] failed to load snapshot", err)
        if (active) {
          setError("Unable to open this canvas")
          setSnapshot(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [canvasId])

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#03050a] text-white/70">
        <p className="text-xs uppercase tracking-[0.4em]">Loading canvas…</p>
        <Link
          to="/canvas"
          className="text-[11px] uppercase tracking-[0.3em] text-white/40 hover:text-white"
        >
          Back to projects
        </Link>
      </div>
    )
  }

  if (error || !snapshot) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#03050a] text-white">
        <p className="text-lg text-white/80">{error ?? "Canvas not found."}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-full bg-white/10 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white backdrop-blur transition hover:bg-white/20"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          <Link
            to="/canvas"
            className="rounded-full border border-white/30 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:text-white"
          >
            Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#01040d]">
      <BladeCanvasExperience
        initialCanvas={snapshot.canvas}
        initialImages={snapshot.images}
      />
    </div>
  )
}
