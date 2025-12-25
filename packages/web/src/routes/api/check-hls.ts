import { createFileRoute } from "@tanstack/react-router"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Cloudflare customer subdomain
const CLOUDFLARE_CUSTOMER_CODE = "xctsztqzu046isdc"

function getHlsUrl(): string {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const liveInputUid = ctx?.cloudflare?.env?.CLOUDFLARE_LIVE_INPUT_UID
    if (liveInputUid) {
      return `https://customer-${CLOUDFLARE_CUSTOMER_CODE}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
    }
  } catch {}
  // Fallback - should not happen in production
  throw new Error("CLOUDFLARE_LIVE_INPUT_UID not configured")
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
