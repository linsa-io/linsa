import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { streams } from "@/db/schema"
import { getAuth } from "@/lib/auth"
import { resolveStreamPlayback } from "@/lib/stream/playback"

const resolveDatabaseUrl = (request: Request) => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const url = ctx?.cloudflare?.env?.DATABASE_URL
    if (url) return url
  } catch {}
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL is not configured")
}

// GET current user's stream
const getStream = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const database = getDb(resolveDatabaseUrl(request))
    const stream = await database.query.streams.findFirst({
      where: eq(streams.user_id, session.user.id),
    })

    if (!stream) {
      return new Response(JSON.stringify({ error: "No stream configured" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const playback = resolveStreamPlayback({
      hlsUrl: stream.hls_url,
      webrtcUrl: stream.webrtc_url,
    })

    return new Response(JSON.stringify({ ...stream, playback }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Stream GET error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

// PUT update stream settings
const updateStream = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const body = await request.json()
    const { title, description, hls_url, webrtc_url, is_live } = body as {
      title?: string
      description?: string
      hls_url?: string
      webrtc_url?: string
      is_live?: boolean
    }

    const database = getDb(resolveDatabaseUrl(request))

    const stream = await database.query.streams.findFirst({
      where: eq(streams.user_id, session.user.id),
    })

    if (!stream) {
      return new Response(JSON.stringify({ error: "No stream configured" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (hls_url !== undefined) updates.hls_url = hls_url
    if (webrtc_url !== undefined) updates.webrtc_url = webrtc_url
    if (is_live !== undefined) {
      updates.is_live = is_live
      if (is_live && !stream.started_at) {
        updates.started_at = new Date()
      } else if (!is_live) {
        updates.ended_at = new Date()
      }
    }

    await database
      .update(streams)
      .set(updates)
      .where(eq(streams.id, stream.id))

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Stream PUT error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: getStream,
      PUT: updateStream,
    },
  },
})
