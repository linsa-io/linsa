import { createFileRoute } from "@tanstack/react-router"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/connection"
import { getAuth } from "@/lib/auth"
import { hasCreatorSubscription } from "@/lib/billing"
import { stream_replays, streams } from "@/db/schema"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

const REPLAY_STATUSES = ["recording", "processing", "ready", "failed"] as const
type ReplayStatus = (typeof REPLAY_STATUSES)[number]

const parseStatus = (value: unknown): ReplayStatus | null => {
  if (typeof value !== "string") return null
  if ((REPLAY_STATUSES as readonly string[]).includes(value)) {
    return value as ReplayStatus
  }
  return null
}

const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.valueOf())) return parsed
  }
  return null
}

const resolveStreamKey = (request: Request, body?: Record<string, unknown>) => {
  const headerKey = request.headers.get("x-stream-key")?.trim()
  if (headerKey) return headerKey
  if (body && typeof body.stream_key === "string") {
    const key = body.stream_key.trim()
    if (key) return key
  }
  return null
}

const canAccessReplay = async (request: Request, replayUserId: string) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (session?.user?.id && session.user.id === replayUserId) {
    return true
  }
  return false
}

const canEditReplay = async (
  request: Request,
  replayStreamId: string,
  replayUserId: string,
  body?: Record<string, unknown>,
) => {
  if (await canAccessReplay(request, replayUserId)) {
    return true
  }

  const streamKey = resolveStreamKey(request, body)
  if (!streamKey) return false

  const database = db()
  const stream = await database.query.streams.findFirst({
    where: and(eq(streams.id, replayStreamId), eq(streams.stream_key, streamKey)),
  })

  return Boolean(stream)
}

// GET /api/stream-replays/:replayId
const handleGet = async ({
  request,
  params,
}: {
  request: Request
  params: { replayId: string }
}) => {
  const database = db()
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  const replay = await database.query.stream_replays.findFirst({
    where: eq(stream_replays.id, params.replayId),
  })

  if (!replay) {
    return json({ error: "Replay not found" }, 404)
  }

  const isOwner = session?.user?.id === replay.user_id

  // Owners can always view their own replays
  if (isOwner) {
    return json({ replay })
  }

  // Non-owners need subscription to this creator to view replays
  if (!session?.user?.id) {
    return json(
      { error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" },
      403
    )
  }

  const hasSubscription = await hasCreatorSubscription(session.user.id, replay.user_id)
  if (!hasSubscription) {
    return json(
      { error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" },
      403
    )
  }

  // With subscription, can view public ready replays
  if (!replay.is_public || replay.status !== "ready") {
    return json({ error: "Forbidden" }, 403)
  }

  return json({ replay })
}

// PATCH /api/stream-replays/:replayId
const handlePatch = async ({
  request,
  params,
}: {
  request: Request
  params: { replayId: string }
}) => {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const database = db()
  const replay = await database.query.stream_replays.findFirst({
    where: eq(stream_replays.id, params.replayId),
  })

  if (!replay) {
    return json({ error: "Replay not found" }, 404)
  }

  const canEdit = await canEditReplay(
    request,
    replay.stream_id,
    replay.user_id,
    body,
  )

  if (!canEdit) {
    return json({ error: "Unauthorized" }, 401)
  }

  const updateData: Partial<typeof stream_replays.$inferInsert> = {
    updated_at: new Date(),
  }

  if (typeof body.title === "string") {
    const title = body.title.trim()
    if (!title) {
      return json({ error: "Title cannot be empty" }, 400)
    }
    updateData.title = title
  }

  if (typeof body.description === "string") {
    updateData.description = body.description.trim()
  }

  if (body.status !== undefined) {
    const status = parseStatus(body.status)
    if (!status) {
      return json({ error: "Invalid status" }, 400)
    }
    updateData.status = status
  }

  if (typeof body.jazz_replay_id === "string") {
    updateData.jazz_replay_id = body.jazz_replay_id.trim()
  }

  if (typeof body.playback_url === "string") {
    updateData.playback_url = body.playback_url.trim()
  }

  if (typeof body.thumbnail_url === "string") {
    updateData.thumbnail_url = body.thumbnail_url.trim()
  }

  if (body.started_at !== undefined) {
    const startedAt = parseDate(body.started_at)
    if (!startedAt) {
      return json({ error: "Invalid started_at" }, 400)
    }
    updateData.started_at = startedAt
  }

  if (body.ended_at !== undefined) {
    const endedAt = parseDate(body.ended_at)
    if (!endedAt) {
      return json({ error: "Invalid ended_at" }, 400)
    }
    updateData.ended_at = endedAt
  }

  if (typeof body.duration_seconds === "number") {
    updateData.duration_seconds = Math.max(0, Math.floor(body.duration_seconds))
  } else if (
    updateData.duration_seconds === undefined &&
    updateData.started_at &&
    updateData.ended_at
  ) {
    updateData.duration_seconds = Math.max(
      0,
      Math.floor(
        (updateData.ended_at.getTime() - updateData.started_at.getTime()) / 1000,
      ),
    )
  }

  if (typeof body.is_public === "boolean") {
    updateData.is_public = body.is_public
  }

  if (Object.keys(updateData).length === 1) {
    return json({ error: "No fields to update" }, 400)
  }

  try {
    const [updated] = await database
      .update(stream_replays)
      .set(updateData)
      .where(eq(stream_replays.id, params.replayId))
      .returning()

    return json({ replay: updated })
  } catch (error) {
    console.error("[stream-replays] Error updating replay:", error)
    return json({ error: "Failed to update replay" }, 500)
  }
}

export const Route = createFileRoute("/api/stream-replays/$replayId")({
  server: {
    handlers: {
      GET: handleGet,
      PATCH: handlePatch,
    },
  },
})
