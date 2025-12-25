import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { users, streams } from "@/db/schema"
import { getAuth } from "@/lib/auth"
import { randomUUID } from "crypto"
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
    if (url) return url
  } catch {}
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL is not configured")
}

// GET current user profile
const getProfile = async ({ request }: { request: Request }) => {
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
    const user = await database.query.users.findFirst({
      where: eq(users.id, session.user.id),
    })

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    // Also get stream info
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

    return new Response(
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        image: user.image,
        bio: user.bio,
        website: user.website,
        stream: stream
          ? {
              id: stream.id,
              title: stream.title,
              is_live: stream.is_live,
              hls_url: stream.hls_url,
              webrtc_url: webRtcUrl,
              playback,
              stream_key: stream.stream_key,
            }
          : null,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  } catch (error) {
    console.error("Profile GET error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

// PUT update profile (name, username)
const updateProfile = async ({ request }: { request: Request }) => {
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
    const { name, username, image, bio, website } = body as {
      name?: string
      username?: string
      image?: string | null
      bio?: string | null
      website?: string | null
    }

    const database = getDb(resolveDatabaseUrl(request))

    // Validate username format
    if (username !== undefined) {
      if (username.length < 3) {
        return new Response(
          JSON.stringify({ error: "Username must be at least 3 characters" }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }
      if (!/^[a-z0-9_-]+$/.test(username)) {
        return new Response(
          JSON.stringify({ error: "Username can only contain lowercase letters, numbers, hyphens, and underscores" }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      // Check if username is taken
      const existing = await database.query.users.findFirst({
        where: eq(users.username, username),
      })
      if (existing && existing.id !== session.user.id) {
        return new Response(
          JSON.stringify({ error: "Username is already taken" }),
          { status: 409, headers: { "content-type": "application/json" } }
        )
      }
    }

    // Update user
    const updates: Record<string, string | null> = { updatedAt: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (username !== undefined) updates.username = username
    if (image !== undefined) updates.image = image
    if (bio !== undefined) updates.bio = bio
    if (website !== undefined) updates.website = website

    await database
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))

    // If username is set for first time, create a stream record
    if (username) {
      const existingStream = await database.query.streams.findFirst({
        where: eq(streams.user_id, session.user.id),
      })

      if (!existingStream) {
        await database.insert(streams).values({
          id: randomUUID(),
          user_id: session.user.id,
          title: `${name || username}'s Stream`,
          stream_key: randomUUID().replace(/-/g, ""),
          is_live: false,
          viewer_count: 0,
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Profile PUT error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: getProfile,
      PUT: updateProfile,
    },
  },
})
