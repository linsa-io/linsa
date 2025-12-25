import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { users, streams } from "@/db/schema"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Default Cloudflare customer subdomain (linsa's account)
const DEFAULT_CLOUDFLARE_CUSTOMER_CODE = "xctsztqzu046isdc"

const getServerEnv = () => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    return getServerContext()?.cloudflare?.env ?? {}
  } catch {}
  return {}
}

const resolveDatabaseUrl = () => {
  const env = getServerEnv()
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL is not configured")
}

// Construct Cloudflare Stream HLS URL from live input UID
const buildCloudflareHlsUrl = (liveInputUid: string, customerCode?: string | null): string => {
  const code = customerCode || DEFAULT_CLOUDFLARE_CUSTOMER_CODE
  return `https://customer-${code}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
}

// Fallback to env variable for backwards compatibility
const resolveEnvCloudflareHlsUrl = (): string | null => {
  const env = getServerEnv()
  const liveInputUid = env.CLOUDFLARE_LIVE_INPUT_UID
  if (liveInputUid) {
    return buildCloudflareHlsUrl(liveInputUid)
  }
  return null
}

function isHlsPlaylistLive(manifest: string): boolean {
  const upper = manifest.toUpperCase()

  // Basic validation
  const isValidManifest = upper.includes("#EXTM3U")
  if (!isValidManifest) return false

  // Master playlists are always "live" in the sense they redirect to variants
  const isMasterPlaylist = upper.includes("#EXT-X-STREAM-INF")
  if (isMasterPlaylist) return true

  // Check for obvious VOD markers
  const hasEndlist = upper.includes("#EXT-X-ENDLIST")
  const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
  if (hasEndlist || isVod) return false

  // Must have segments
  const hasSegments = upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
  if (!hasSegments) return false

  // CRITICAL: Check for segment freshness
  // Extract #EXT-X-PROGRAM-DATE-TIME tags which indicate segment timestamps
  const programDateTimeMatches = manifest.match(/#EXT-X-PROGRAM-DATE-TIME:([^\n]+)/gi)

  if (programDateTimeMatches && programDateTimeMatches.length > 0) {
    // Get the most recent timestamp
    const lastTimestamp = programDateTimeMatches[programDateTimeMatches.length - 1]
      .replace(/#EXT-X-PROGRAM-DATE-TIME:/i, '')
      .trim()

    try {
      const segmentDate = new Date(lastTimestamp)
      const now = new Date()
      const ageSeconds = (now.getTime() - segmentDate.getTime()) / 1000

      // Only consider live if last segment is less than 60 seconds old
      // This prevents showing old recordings as "live"
      if (ageSeconds > 60) {
        console.log(`[check-hls] Segment too old: ${ageSeconds}s ago - NOT LIVE`)
        return false
      }

      console.log(`[check-hls] Fresh segment: ${ageSeconds}s ago - LIVE`)
      return true
    } catch (err) {
      console.error(`[check-hls] Failed to parse timestamp: ${lastTimestamp}`, err)
    }
  }

  // If no program-date-time tags, check for media sequence
  // A live stream should have a non-zero media sequence
  const mediaSequenceMatch = manifest.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/i)
  if (mediaSequenceMatch) {
    const sequence = parseInt(mediaSequenceMatch[1], 10)
    // If media sequence is incrementing, it's likely live
    // But without timestamps, we can't be sure it's not an old recording
    console.log(`[check-hls] Media sequence: ${sequence}, no timestamps - assuming NOT LIVE (safety)`)
    return false
  }

  // If we get here, manifest looks like a live stream but has no timestamps
  // Be conservative and return false to avoid showing old streams
  console.log(`[check-hls] No timestamp markers - assuming NOT LIVE (safety)`)
  return false
}

export const Route = createFileRoute("/api/streams/$username/check-hls")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { username } = params

        if (!username) {
          return json({ error: "Username required" }, 400)
        }

        try {
          // Hardcoded config for nikiv (stored in Jazz, not Postgres)
          if (username === "nikiv") {
            const hlsUrl = buildCloudflareHlsUrl("bb7858eafc85de6c92963f3817477b5d", "xctsztqzu046isdc")

            const res = await fetch(hlsUrl, { cache: "no-store" })

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

            return json({
              isLive,
              hlsUrl,
              status: res.status,
              manifestLength: manifest.length,
            })
          }

          const database = getDb(resolveDatabaseUrl())

          const user = await database.query.users.findFirst({
            where: eq(users.username, username),
          })

          if (!user) {
            return json({ error: "User not found", isLive: false }, 404)
          }

          const stream = await database.query.streams.findFirst({
            where: eq(streams.user_id, user.id),
          })

          // Priority for HLS URL:
          // 1. Stream's cloudflare_live_input_uid (per-user Cloudflare Stream)
          // 2. Stream's hls_url (manually configured)
          // 3. Environment variable (backwards compatibility)
          let hlsUrl: string | null = null

          if (stream?.cloudflare_live_input_uid) {
            hlsUrl = buildCloudflareHlsUrl(
              stream.cloudflare_live_input_uid,
              stream.cloudflare_customer_code
            )
          } else if (stream?.hls_url) {
            hlsUrl = stream.hls_url
          } else {
            hlsUrl = resolveEnvCloudflareHlsUrl()
          }

          if (!hlsUrl) {
            return json({
              isLive: false,
              hlsUrl: null,
              error: "No stream configured. Add your Cloudflare Live Input UID in settings.",
            })
          }

          const res = await fetch(hlsUrl, { cache: "no-store" })

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
            error: error.message,
          })
        }
      },
    },
  },
})
