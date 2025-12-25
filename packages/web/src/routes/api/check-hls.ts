import { createFileRoute, getServerContext } from "@tanstack/react-router"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Default video ID (fallback)
const DEFAULT_VIDEO_ID = "cd56ef73791c628c252cd290ee710275"

function getHlsUrl(): string {
  const ctx = (getServerContext as () => { cloudflare?: { env?: Record<string, string> } } | null)()
  const videoId = ctx?.cloudflare?.env?.CLOUDFLARE_STREAM_NIKIV_VIDEO_ID || DEFAULT_VIDEO_ID
  return `https://customer-xctsztqzu046isdc.cloudflarestream.com/${videoId}/manifest/video.m3u8`
}

function isHlsPlaylistLive(manifest: string): boolean {
  const upper = manifest.toUpperCase()
  const hasEndlist = upper.includes("#EXT-X-ENDLIST")
  const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
  const hasSegments = upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
  const isValidManifest = upper.includes("#EXTM3U")
  // Master playlists have #EXT-X-STREAM-INF but no segments - they're still "live"
  const isMasterPlaylist = upper.includes("#EXT-X-STREAM-INF")

  // A manifest is live if:
  // 1. It's a valid HLS manifest
  // 2. AND (it's a master playlist OR it has segments without ENDLIST/VOD markers)
  return isValidManifest && (isMasterPlaylist || (!hasEndlist && !isVod && hasSegments))
}

export const Route = createFileRoute("/api/check-hls")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const hlsUrl = getHlsUrl()
          const res = await fetch(hlsUrl, {
            cache: "no-store",
          })

          console.log("[check-hls] Response status:", res.status)

          if (!res.ok) {
            return json({
              isLive: false,
              hlsUrl,
              status: res.status,
              error: "HLS not available",
            })
          }

          const manifest = await res.text()
          const isLive = isHlsPlaylistLive(manifest)

          console.log("[check-hls] Manifest check:", {
            isLive,
            manifestLength: manifest.length,
            first200: manifest.slice(0, 200),
          })

          return json({
            isLive,
            hlsUrl,
            status: res.status,
            manifestLength: manifest.length,
          })
        } catch (err) {
          const error = err as Error
          console.error("[check-hls] Error:", error.message)
          return json({
            isLive: false,
            hlsUrl: getHlsUrl(),
            error: error.message,
          })
        }
      },
    },
  },
})
