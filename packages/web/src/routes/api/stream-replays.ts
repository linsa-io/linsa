import { createFileRoute } from "@tanstack/react-router"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db/connection"
import { getAuth } from "@/lib/auth"
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

const resolveStream = async (
  request: Request,
  body: Record<string, unknown>,
) => {
  const database = db()
  const headerKey = request.headers.get("x-stream-key")?.trim()
  const bodyKey =
    typeof body.stream_key === "string" ? body.stream_key.trim() : null
  const streamKey = headerKey || bodyKey

  if (streamKey) {
    return database.query.streams.findFirst({
      where: eq(streams.stream_key, streamKey),
    })
  }

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return null
  }

  return database.query.streams.findFirst({
    where: eq(streams.user_id, session.user.id),
  })
}

// GET /api/stream-replays - list current user's replays
const handleGet = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, 401)
  }

  const database = db()

  try {
    const replays = await database
      .select()
      .from(stream_replays)
      .where(eq(stream_replays.user_id, session.user.id))
      .orderBy(desc(stream_replays.started_at), desc(stream_replays.created_at))

    return json({ replays })
  } catch (error) {
    console.error("[stream-replays] Error fetching replays:", error)
    return json({ error: "Failed to fetch replays" }, 500)
  }
}

// POST /api/stream-replays - create replay (stream-key or owner session)
const handlePost = async ({ request }: { request: Request }) => {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const stream = await resolveStream(request, body)
  if (!stream) {
    return json({ error: "Unauthorized" }, 401)
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Stream Replay"
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined
  const statusValue =
    body.status !== undefined ? parseStatus(body.status) : null
  if (body.status !== undefined && !statusValue) {
    return json({ error: "Invalid status" }, 400)
  }
  const status = statusValue ?? "processing"
  const jazzReplayId =
    typeof body.jazz_replay_id === "string" && body.jazz_replay_id.trim()
      ? body.jazz_replay_id.trim()
      : undefined
  const playbackUrl =
    typeof body.playback_url === "string" && body.playback_url.trim()
      ? body.playback_url.trim()
      : undefined
  const thumbnailUrl =
    typeof body.thumbnail_url === "string" && body.thumbnail_url.trim()
      ? body.thumbnail_url.trim()
      : undefined
  const startedAtRaw = body.started_at
  const endedAtRaw = body.ended_at
  const startedAt = parseDate(startedAtRaw)
  const endedAt = parseDate(endedAtRaw)
  if (startedAtRaw !== undefined && !startedAt) {
    return json({ error: "Invalid started_at" }, 400)
  }
  if (endedAtRaw !== undefined && !endedAt) {
    return json({ error: "Invalid ended_at" }, 400)
  }
  const durationSeconds =
    typeof body.duration_seconds === "number"
      ? Math.max(0, Math.floor(body.duration_seconds))
      : startedAt && endedAt
        ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
        : undefined
  const isPublic =
    typeof body.is_public === "boolean" ? body.is_public : undefined

  const database = db()

  try {
    const [replay] = await database
      .insert(stream_replays)
      .values({
        stream_id: stream.id,
        user_id: stream.user_id,
        title,
        description,
        status,
        jazz_replay_id: jazzReplayId,
        playback_url: playbackUrl,
        thumbnail_url: thumbnailUrl,
        started_at: startedAt ?? undefined,
        ended_at: endedAt ?? undefined,
        duration_seconds: durationSeconds,
        is_public: isPublic ?? false,
      })
      .returning()

    return json({ replay }, 201)
  } catch (error) {
    console.error("[stream-replays] Error creating replay:", error)
    return json({ error: "Failed to create replay" }, 500)
  }
}

export const Route = createFileRoute("/api/stream-replays")({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
})
