import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { streams, users } from "@/db/schema"

const resolveDatabaseUrl = () => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => {
        cloudflare?: { env?: Record<string, string> }
      } | null
    }
    const ctx = getServerContext()
    const url = ctx?.cloudflare?.env?.DATABASE_URL
    if (url) return url
  } catch {
    // Not in server context
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL not configured")
}

// GET - fetch current viewer count from database
const getViewerCount = async ({
  params,
}: {
  request: Request
  params: { username: string }
}) => {
  const { username } = params

  try {
    const db = getDb(resolveDatabaseUrl())

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    })

    if (!user) {
      return Response.json({ viewerCount: 0, username })
    }

    const stream = await db.query.streams.findFirst({
      where: eq(streams.user_id, user.id),
    })

    return Response.json({
      viewerCount: stream?.viewer_count ?? 0,
      username,
      isLive: stream?.is_live ?? false,
    })
  } catch (error) {
    console.error("Failed to get viewer count:", error)
    return Response.json({ viewerCount: 0, username })
  }
}

// POST - update viewer count (called by Jazz client)
const updateViewerCount = async ({
  request,
  params,
}: {
  request: Request
  params: { username: string }
}) => {
  const { username } = params

  try {
    const body = await request.json()
    const { viewerCount } = body as { viewerCount: number }

    if (typeof viewerCount !== "number" || viewerCount < 0) {
      return Response.json({ error: "Invalid viewer count" }, { status: 400 })
    }

    const db = getDb(resolveDatabaseUrl())

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    })

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    await db
      .update(streams)
      .set({ viewer_count: viewerCount })
      .where(eq(streams.user_id, user.id))

    return Response.json({ success: true, viewerCount, username })
  } catch (error) {
    console.error("Failed to update viewer count:", error)
    return Response.json({ error: "Failed to update" }, { status: 500 })
  }
}

export const Route = createFileRoute("/api/streams/$username/viewers")({
  server: {
    handlers: {
      GET: getViewerCount,
      POST: updateViewerCount,
    },
  },
})
