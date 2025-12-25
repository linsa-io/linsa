import { Play, Clock, Calendar } from "lucide-react"
import { Link } from "@tanstack/react-router"

interface Replay {
  id: string
  title: string | null
  playback_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  started_at: string | null
  status: string | null
}

interface ReplayGridProps {
  replays: Replay[]
  username: string
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date"
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ReplayGrid({ replays, username }: ReplayGridProps) {
  if (replays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-white/40 mb-3">
          <Play className="w-12 h-12" />
        </div>
        <p className="text-white/60 text-sm">No past streams available yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {replays.map((replay) => (
        <div
          key={replay.id}
          className="group relative bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors border border-white/10"
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-black">
            {replay.thumbnail_url ? (
              <img
                src={replay.thumbnail_url}
                alt={replay.title || "Stream replay"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-12 h-12 text-white/20" />
              </div>
            )}

            {/* Play overlay */}
            {replay.playback_url && replay.status === "ready" && (
              <Link
                to={`/${username}/replay/${replay.id}`}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-8 h-8 text-black ml-1" />
                </div>
              </Link>
            )}

            {/* Duration badge */}
            {replay.duration_seconds && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(replay.duration_seconds)}
              </div>
            )}

            {/* Status badge */}
            {replay.status === "processing" && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500/90 rounded text-xs text-black font-medium">
                Processing...
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
              {replay.title || "Untitled Stream"}
            </h3>
            {replay.started_at && (
              <div className="flex items-center gap-1 text-white/50 text-xs">
                <Calendar className="w-3 h-3" />
                {formatDate(replay.started_at)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
