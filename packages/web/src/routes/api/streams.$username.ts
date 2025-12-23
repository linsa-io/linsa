import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { users, streams } from "@/db/schema"
import {
  resolveCloudflareStreamRef,
  resolveStreamPlayback,
  resolveWebRtcUrl,
} from "@/lib/stream/playback"

const resolveDatabaseUrl = (request: Request) => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const url = ctx?.cloudflare?.env?.DATABASE_URL
    if (url) {
      return url
    }
  } catch {
    // probably not running inside server context
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  throw new Error("DATABASE_URL is not configured")
}

const serve = async ({
  request,
  params,
}: {
  request: Request
  params: { username: string }
}) => {
  const { username } = params

  if (!username) {
    return new Response(JSON.stringify({ error: "Username required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const database = getDb(resolveDatabaseUrl(request))

    const user = await database.query.users.findFirst({
      where: eq(users.username, username),
    })

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const stream = await database.query.streams.findFirst({
      where: eq(streams.user_id, user.id),
    })

    const cloudflare = stream
      ? resolveCloudflareStreamRef({ hlsUrl: stream.hls_url })
      : null
    const webRtcUrl = stream
      ? resolveWebRtcUrl({ webrtcUrl: stream.webrtc_url, cloudflare })
      : null
    const playback = stream
      ? resolveStreamPlayback({
          hlsUrl: stream.hls_url,
          webrtcUrl: stream.webrtc_url,
        })
      : null

    const data = {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      },
      stream: stream
        ? {
            id: stream.id,
            title: stream.title,
            description: stream.description,
            is_live: stream.is_live,
            viewer_count: stream.viewer_count,
            hls_url: stream.hls_url,
            webrtc_url: webRtcUrl,
            playback,
            thumbnail_url: stream.thumbnail_url,
            started_at: stream.started_at?.toISOString() ?? null,
          }
        : null,
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Stream API error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/streams/$username")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
