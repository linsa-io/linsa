import { useState, useEffect, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAccount } from "jazz-tools/react"
import { ViewerAccount, type GlideCanvasItem } from "@/lib/jazz/schema"
import { Image, Trash2, ExternalLink, RefreshCw } from "lucide-react"

export const Route = createFileRoute("/glide")({
  component: GlidePage,
  ssr: false,
})

function GlidePage() {
  const me = useAccount(ViewerAccount)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const root = me.$isLoaded ? me.root : null
  const canvasList = root?.$isLoaded ? root.glideCanvas : null

  // Auto-sync pending items every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void syncPendingItems()
    }, 5000)
    return () => clearInterval(interval)
  }, [root])

  const syncPendingItems = useCallback(async () => {
    if (!root?.glideCanvas?.$isLoaded || syncing) return

    setSyncing(true)
    try {
      // Fetch pending items from API
      const response = await fetch("/api/glide-canvas")
      if (!response.ok) {
        console.error("[glide] Failed to fetch pending items")
        return
      }

      const data = (await response.json()) as { items: GlideCanvasItem[] }
      const pendingItems = data.items

      if (pendingItems.length === 0) {
        return
      }

      console.log(`[glide] Syncing ${pendingItems.length} pending items to Jazz...`)

      // Get existing IDs to avoid duplicates
      const existingIds = new Set(
        root.glideCanvas.$isLoaded
          ? [...root.glideCanvas].map((item) => item.id)
          : []
      )

      // Push new items to Jazz
      let addedCount = 0
      for (const item of pendingItems) {
        if (!existingIds.has(item.id)) {
          root.glideCanvas.$jazz.push(item)
          addedCount++
        }
      }

      if (addedCount > 0) {
        console.log(`[glide] Added ${addedCount} new items to Jazz`)

        // Clear pending items after successful sync
        await fetch("/api/glide-canvas", { method: "DELETE" })
        setLastSync(new Date())
      }
    } catch (error) {
      console.error("[glide] Sync error:", error)
    } finally {
      setSyncing(false)
    }
  }, [root, syncing])

  const handleManualSync = () => {
    void syncPendingItems()
  }

  const handleDeleteItem = (index: number) => {
    if (!root?.glideCanvas?.$isLoaded) return
    root.glideCanvas.$jazz.splice(index, 1)
  }

  if (!me.$isLoaded || !root?.$isLoaded) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <p className="text-slate-400">Loading Jazz...</p>
      </div>
    )
  }

  const canvasItems: GlideCanvasItem[] = canvasList?.$isLoaded ? [...canvasList] : []

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Image className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-semibold">Glide Canvas</h1>
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

        {canvasItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No canvas items yet</p>
            <p className="text-sm mt-1">
              Capture screenshots from Glide browser (Ctrl+F) to see them here
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {canvasItems.map((item, index) => (
              <CanvasItemCard
                key={item.id}
                item={item}
                index={index}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CanvasItemCard({
  item,
  index,
  onDelete,
}: {
  item: GlideCanvasItem
  index: number
  onDelete: (index: number) => void
}) {
  const imageUrl = item.imageData ? `data:image/png;base64,${item.imageData}` : null
  const createdAt = new Date(item.createdAt)

  return (
    <div className="group relative bg-[#0c0f18] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
      {imageUrl && (
        <div className="aspect-video bg-slate-900 relative overflow-hidden">
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.title}</p>
            <p className="text-xs text-white/50 mt-1">
              {item.type} · {createdAt.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {item.metadata?.from && (
          <p className="text-xs text-teal-400 mt-2">
            From: {item.metadata.from as string}
          </p>
        )}
        {item.position && (
          <p className="text-xs text-white/40 mt-1">
            Position: ({Math.round(item.position.x)}, {Math.round(item.position.y)})
          </p>
        )}
      </div>
    </div>
  )
}
