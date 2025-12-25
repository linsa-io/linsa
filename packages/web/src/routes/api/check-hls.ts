import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { users } from "@/db/schema"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Cloudflare customer subdomain
const CLOUDFLARE_CUSTOMER_CODE = "xctsztqzu046isdc"

function getEnvFromContext(): { hlsUrl: string; databaseUrl: string | null } {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const liveInputUid = ctx?.cloudflare?.env?.CLOUDFLARE_LIVE_INPUT_UID
    const databaseUrl = ctx?.cloudflare?.env?.DATABASE_URL ?? process.env.DATABASE_URL ?? null

    if (liveInputUid) {
      return {
        hlsUrl: `https://customer-${CLOUDFLARE_CUSTOMER_CODE}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`,
        databaseUrl,
      }
    }
  } catch {}
  throw new Error("CLOUDFLARE_LIVE_INPUT_UID not configured")
}

async function getNikivProfile(databaseUrl: string | null) {
  if (!databaseUrl) return null

  try {
    const database = getDb(databaseUrl)
    const user = await database.query.users.findFirst({
      where: eq(users.username, "nikiv"),
    })

    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bio: user.bio ?? null,
      website: user.website ?? null,
      location: user.location ?? null,
      joinedAt: user.createdAt?.toISOString() ?? null,
    }
  } catch (err) {
    console.error("[check-hls] Failed to fetch nikiv profile:", err)
    return null
  }
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
          const { hlsUrl, databaseUrl } = getEnvFromContext()

          // Fetch profile and HLS status in parallel
          const [profile, hlsRes] = await Promise.all([
            getNikivProfile(databaseUrl),
            fetch(hlsUrl, { cache: "no-store" }),
          ])

          console.log("[check-hls] Response status:", hlsRes.status)

          if (!hlsRes.ok) {
            return json({
              isLive: false,
              hlsUrl,
              profile,
              status: hlsRes.status,
              error: "HLS not available",
            })
          }

          const manifest = await hlsRes.text()
          const isLive = isHlsPlaylistLive(manifest)

          console.log("[check-hls] Manifest check:", {
            isLive,
            manifestLength: manifest.length,
            first200: manifest.slice(0, 200),
          })

          return json({
            isLive,
            hlsUrl,
            profile,
            status: hlsRes.status,
            manifestLength: manifest.length,
          })
        } catch (err) {
          const error = err as Error
          console.error("[check-hls] Error:", error.message)
          return json({
            isLive: false,
            hlsUrl: null,
            profile: null,
            error: error.message,
          })
        }
      },
    },
  },
})
