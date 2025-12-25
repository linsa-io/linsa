import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAccount } from "jazz-tools/react"
import { ViewerAccount, type StreamRecording, StreamRecordingList } from "@/lib/jazz/schema"
import { StreamTimeline } from "@/components/StreamTimeline"
import { Video, RefreshCw } from "lucide-react"
import { co } from "jazz-tools"

export const Route = createFileRoute("/streams")({
  component: StreamsPage,
  ssr: false,
})

function StreamsPage() {
  const me = useAccount(ViewerAccount)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const root = me.$isLoaded ? me.root : null
  const recordingsList = root?.$isLoaded ? root.streamRecordings : null

  // Auto-sync pending recordings from API every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void syncPendingRecordings()
    }, 5000)
    return () => clearInterval(interval)
  }, [root])

  const syncPendingRecordings = async () => {
    if (!root?.streamRecordings?.$isLoaded || syncing) return

    setSyncing(true)
    try {
      // Fetch pending recordings from stream-guard API
      const response = await fetch("/api/stream-recording")
      if (!response.ok) {
        console.error("[streams] Failed to fetch recordings")
        return
      }

      const data = (await response.json()) as {
        recordings: Array<{
          streamId: string
          title: string
          startedAt: number
          endedAt?: number
          streamKey: string
          status: string
          chunks: Array<{ index: number; timestamp: number; size: number }>
          metadata?: {
            width?: number
            height?: number
            fps?: number
            bitrate?: number
          }
        }>
      }

      const pendingRecordings = data.recordings

      if (pendingRecordings.length === 0) {
        return
      }

      console.log(`[streams] Found ${pendingRecordings.length} recordings to sync`)

      // Get existing IDs to avoid duplicates
      const existingKeys = new Set(
        root.streamRecordings.$isLoaded
          ? [...root.streamRecordings].map((item) => item.streamKey)
          : []
      )

      // Process each recording
      for (const rec of pendingRecordings) {
        if (existingKeys.has(rec.streamKey)) {
          // Update existing recording
          const existing = [...root.streamRecordings].find(
            (r) => r.streamKey === rec.streamKey
          )
          if (existing && rec.endedAt && !existing.endedAt) {
            // Mark as ended
            existing.endedAt = rec.endedAt
            existing.isLive = false
            existing.durationMs = rec.endedAt - rec.startedAt
          }
          continue
        }

        // Create new recording in Jazz
        try {
          // Create FileStream from chunks
          const fileStream = co.fileStream().create({ owner: me })

          // Start the stream with metadata
          fileStream.start({
            mimeType: "video/x-matroska", // .mkv format
            fileName: `${rec.title}.mkv`,
            totalSizeBytes: rec.chunks.reduce((sum, c) => sum + c.size, 0),
          })

          // Fetch and push chunks
          for (const chunk of rec.chunks) {
            try {
              const chunkData = await fetch(
                `/api/stream-recording/chunk?streamId=${encodeURIComponent(rec.streamId)}&index=${chunk.index}`
              ).then((r) => r.arrayBuffer())

              fileStream.push(new Uint8Array(chunkData))
            } catch (err) {
              console.error(`[streams] Failed to fetch chunk ${chunk.index}:`, err)
            }
          }

          // End the stream if recording is complete
          if (rec.status === "ended") {
            fileStream.end()
          }

          // Create StreamRecording object
          const recording = {
            title: rec.title,
            startedAt: rec.startedAt,
            endedAt: rec.endedAt || null,
            durationMs: rec.endedAt
              ? rec.endedAt - rec.startedAt
              : Date.now() - rec.startedAt,
            streamKey: rec.streamKey,
            isLive: rec.status === "recording",
            videoFile: fileStream,
            thumbnailData: null,
            metadata: rec.metadata || null,
          }

          // Push to Jazz
          root.streamRecordings.$jazz.push(recording)
          console.log(`[streams] Added recording to Jazz: ${rec.title}`)
          setLastSync(new Date())
        } catch (err) {
          console.error(`[streams] Failed to create recording in Jazz:`, err)
        }
      }
    } catch (error) {
      console.error("[streams] Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  const handleManualSync = () => {
    void syncPendingRecordings()
  }

  if (!me.$isLoaded || !root?.$isLoaded) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <p className="text-slate-400">Loading Jazz...</p>
      </div>
    )
  }

  const recordings: StreamRecording[] = recordingsList?.$isLoaded
    ? [...recordingsList]
    : []

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-semibold">Live Stream Recordings</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="text-xs text-slate-400">
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        {recordings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No stream recordings yet</p>
            <p className="text-sm mt-1">
              Start streaming to stream-guard to see recordings here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {recordings.map((recording, index) => (
              <StreamTimeline key={index} recording={recording} width={900} height={120} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
