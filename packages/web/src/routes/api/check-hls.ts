import { createFileRoute } from "@tanstack/react-router"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Cloudflare Stream HLS URL
const HLS_URL = "https://customer-xctsztqzu046isdc.cloudflarestream.com/bb7858eafc85de6c92963f3817477b5d/manifest/video.m3u8"

function isHlsPlaylistLive(manifest: string): boolean {
  const upper = manifest.toUpperCase()
  const hasEndlist = upper.includes("#EXT-X-ENDLIST")
  const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
  const hasSegments = upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
  const isValidManifest = upper.includes("#EXTM3U")
  return isValidManifest && !hasEndlist && !isVod && hasSegments
}

export const Route = createFileRoute("/api/check-hls")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await fetch(HLS_URL, {
            cache: "no-store",
          })

          console.log("[check-hls] Response status:", res.status)

          if (!res.ok) {
            return json({
              isLive: false,
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
            status: res.status,
            manifestLength: manifest.length,
          })
        } catch (err) {
          const error = err as Error
          console.error("[check-hls] Error:", error.message)
          return json({
            isLive: false,
            error: error.message,
          })
        }
      },
    },
  },
})
