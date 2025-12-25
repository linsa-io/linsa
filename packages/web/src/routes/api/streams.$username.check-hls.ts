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
  const hasEndlist = upper.includes("#EXT-X-ENDLIST")
  const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
  const hasSegments = upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
  const isValidManifest = upper.includes("#EXTM3U")
  const isMasterPlaylist = upper.includes("#EXT-X-STREAM-INF")
  return isValidManifest && (isMasterPlaylist || (!hasEndlist && !isVod && hasSegments))
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
