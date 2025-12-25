import { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, Download, Maximize2 } from "lucide-react"
import type { StreamRecording } from "@/lib/jazz/schema"

interface StreamTimelineProps {
  recording: StreamRecording
  width?: number
  height?: number
}

/**
 * Timeline visualization for live stream recordings
 * Shows horizontal timeline with real-time progress as chunks arrive
 * Supports horizontal scrolling to navigate through the stream
 */
export function StreamTimeline({
  recording,
  width = 800,
  height = 120,
}: StreamTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollX, setScrollX] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Convert Jazz FileStream to blob URL for video player
  useEffect(() => {
    if (recording.videoFile?.$isLoaded) {
      try {
        const blob = recording.videoFile.toBlob()
        if (blob) {
          const url = URL.createObjectURL(blob)
          setVideoUrl(url)
          return () => URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error("[StreamTimeline] Failed to create video URL:", err)
      }
    }
  }, [recording.videoFile])

  // Get stream metadata
  const startedAt = recording.startedAt
  const isLive = recording.isLive
  const duration = recording.durationMs || 0
  const ended = recording.endedAt !== null

  // Calculate timeline metrics
  const pixelsPerMs = 0.05 // 1 second = 50 pixels
  const totalWidth = Math.max(width, duration * pixelsPerMs)
  const visibleDuration = width / pixelsPerMs

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = "#0a0e1a"
    ctx.fillRect(0, 0, width, height)

    // Draw time markers
    const startMs = scrollX / pixelsPerMs
    const endMs = (scrollX + width) / pixelsPerMs

    ctx.strokeStyle = "#1e293b"
    ctx.lineWidth = 1
    ctx.font = "10px monospace"
    ctx.fillStyle = "#64748b"

    // Draw vertical lines every 10 seconds
    const intervalMs = 10000
    const firstMarker = Math.floor(startMs / intervalMs) * intervalMs
    for (let ms = firstMarker; ms <= endMs; ms += intervalMs) {
      const x = ms * pixelsPerMs - scrollX
      if (x >= 0 && x <= width) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()

        // Draw time label
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const secs = seconds % 60
        const label = `${minutes}:${secs.toString().padStart(2, "0")}`
        ctx.fillText(label, x + 4, 12)
      }
    }

    // Draw stream progress bar
    const progressWidth = duration * pixelsPerMs - scrollX
    if (progressWidth > 0) {
      ctx.fillStyle = isLive ? "#22c55e" : "#3b82f6"
      ctx.fillRect(0, height - 20, Math.min(progressWidth, width), 8)
    }

    // Draw current time indicator (playhead)
    if (isPlaying || currentTime > 0) {
      const playheadX = currentTime * pixelsPerMs - scrollX
      if (playheadX >= 0 && playheadX <= width) {
        ctx.strokeStyle = "#f59e0b"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(playheadX, 0)
        ctx.lineTo(playheadX, height)
        ctx.stroke()
      }
    }

    // Draw live indicator if recording is live
    if (isLive) {
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.arc(width - 20, 20, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = "#ffffff"
      ctx.font = "11px monospace"
      ctx.fillText("LIVE", width - 60, 24)
    }
  }, [scrollX, width, height, duration, isLive, isPlaying, currentTime, pixelsPerMs])

  // Handle horizontal scrolling
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaX || e.deltaY
      setScrollX((prev) => {
        const next = prev + delta
        return Math.max(0, Math.min(next, Math.max(0, totalWidth - width)))
      })
    },
    [totalWidth, width]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  // Handle click to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const timeMs = (x + scrollX) / pixelsPerMs

    setCurrentTime(Math.min(timeMs, duration))
    if (isPlaying) {
      setIsPlaying(false)
    }
  }

  // Auto-scroll to follow live stream
  useEffect(() => {
    if (isLive && !isDragging) {
      const targetScroll = Math.max(0, duration * pixelsPerMs - width)
      setScrollX(targetScroll)
    }
  }, [isLive, duration, pixelsPerMs, width, isDragging])

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement("a")
      a.href = videoUrl
      a.download = `${recording.title}.mp4`
      a.click()
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-[#0a0e1a] border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{recording.title}</h3>
          <p className="text-xs text-white/50">
            {new Date(startedAt).toLocaleString()} · {formatTime(duration)}
            {isLive && <span className="text-green-400 ml-2">● Recording</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {videoUrl && (
            <>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Timeline Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg bg-[#0c0f18] border border-white/5"
        style={{ width, height }}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <canvas
          ref={canvasRef}
          style={{ width, height }}
          onClick={handleCanvasClick}
          className="cursor-pointer"
        />
      </div>

      {/* Scroll indicator */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>Scroll or drag to navigate</span>
        <span>
          {formatTime(scrollX / pixelsPerMs)} - {formatTime((scrollX + width) / pixelsPerMs)}
        </span>
      </div>

      {/* Metadata */}
      {recording.metadata && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          {recording.metadata.width && (
            <div className="text-white/50">
              Resolution: {recording.metadata.width}×{recording.metadata.height}
            </div>
          )}
          {recording.metadata.fps && (
            <div className="text-white/50">FPS: {recording.metadata.fps.toFixed(1)}</div>
          )}
          {recording.metadata.bitrate && (
            <div className="text-white/50">
              Bitrate: {(recording.metadata.bitrate / 1000).toFixed(0)}kbps
            </div>
          )}
        </div>
      )}
    </div>
  )
}
