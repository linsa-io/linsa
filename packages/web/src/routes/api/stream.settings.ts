import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { users, streams } from "@/db/schema"
import crypto from "node:crypto"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

const getServerContext = () => {
  try {
    const { getServerContext: gsc } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, unknown> } } | null
    }
    return gsc()
  } catch {}
  return null
}

const resolveDatabaseUrl = () => {
  const ctx = getServerContext()
  const env = ctx?.cloudflare?.env as Record<string, string> | undefined
  if (env?.DATABASE_URL) return env.DATABASE_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error("DATABASE_URL is not configured")
}

// Get user from session cookie
async function getSessionUser(request: Request) {
  const cookie = request.headers.get("cookie")
  if (!cookie) return null

  // Parse session token from cookie
  const sessionMatch = cookie.match(/better-auth\.session_token=([^;]+)/)
  if (!sessionMatch) return null

  const sessionToken = decodeURIComponent(sessionMatch[1])
  const database = getDb(resolveDatabaseUrl())

  // Look up session and get user
  const result = await database.execute<{ userId: string }>(
    `SELECT "userId" FROM sessions WHERE token = $1 AND "expiresAt" > NOW()`,
    [sessionToken]
  )

  if (!result.rows.length) return null

  const user = await database.query.users.findFirst({
    where: eq(users.id, result.rows[0].userId),
  })

  return user
}

export const Route = createFileRoute("/api/stream/settings")({
  server: {
    handlers: {
      // GET - Fetch current user's stream settings
      GET: async ({ request }) => {
        const user = await getSessionUser(request)
        if (!user) {
          return json({ error: "Unauthorized" }, 401)
        }

        const database = getDb(resolveDatabaseUrl())

        let stream = await database.query.streams.findFirst({
          where: eq(streams.user_id, user.id),
        })

        // If no stream exists, create one
        if (!stream) {
          const streamKey = crypto.randomUUID()
          const [newStream] = await database
            .insert(streams)
            .values({
              user_id: user.id,
              stream_key: streamKey,
              title: "Live Stream",
            })
            .returning()
          stream = newStream
        }

        return json({
          id: stream.id,
          title: stream.title,
          description: stream.description,
          cloudflare_live_input_uid: stream.cloudflare_live_input_uid,
          cloudflare_customer_code: stream.cloudflare_customer_code,
          hls_url: stream.hls_url,
          stream_key: stream.stream_key,
        })
      },

      // PUT - Update stream settings
      PUT: async ({ request }) => {
        const user = await getSessionUser(request)
        if (!user) {
          return json({ error: "Unauthorized" }, 401)
        }

        const body = await request.json()
        const {
          title,
          description,
          cloudflare_live_input_uid,
          cloudflare_customer_code,
        } = body

        const database = getDb(resolveDatabaseUrl())

        // Get or create stream
        let stream = await database.query.streams.findFirst({
          where: eq(streams.user_id, user.id),
        })

        if (!stream) {
          const streamKey = crypto.randomUUID()
          const [newStream] = await database
            .insert(streams)
            .values({
              user_id: user.id,
              stream_key: streamKey,
              title: title || "Live Stream",
              description,
              cloudflare_live_input_uid,
              cloudflare_customer_code,
            })
            .returning()
          stream = newStream
        } else {
          // Update existing stream
          const [updatedStream] = await database
            .update(streams)
            .set({
              title: title ?? stream.title,
              description: description ?? stream.description,
              cloudflare_live_input_uid: cloudflare_live_input_uid ?? stream.cloudflare_live_input_uid,
              cloudflare_customer_code: cloudflare_customer_code ?? stream.cloudflare_customer_code,
              updated_at: new Date(),
            })
            .where(eq(streams.id, stream.id))
            .returning()
          stream = updatedStream
        }

        return json({
          success: true,
          stream: {
            id: stream.id,
            title: stream.title,
            description: stream.description,
            cloudflare_live_input_uid: stream.cloudflare_live_input_uid,
            cloudflare_customer_code: stream.cloudflare_customer_code,
          },
        })
      },
    },
  },
})
