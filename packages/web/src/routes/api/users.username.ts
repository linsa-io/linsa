import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

// Username validation: lowercase letters, numbers, underscores, 3-20 chars
const isValidUsername = (username: string): boolean => {
  return /^[a-z0-9_]{3,20}$/.test(username)
}

const handlePost = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const body = await request.json()
  const { username } = body as { username?: string }

  if (!username || typeof username !== "string") {
    return new Response(JSON.stringify({ error: "Username is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const normalizedUsername = username.toLowerCase().trim()

  if (!isValidUsername(normalizedUsername)) {
    return new Response(
      JSON.stringify({
        error:
          "Username must be 3-20 characters, lowercase letters, numbers, or underscores only",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    )
  }

  const database = db()

  // Check if username is already taken (by another user)
  const existing = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1)

  if (existing.length > 0 && existing[0].id !== session.user.id) {
    return new Response(JSON.stringify({ error: "Username is already taken" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    })
  }

  // Update username
  await database
    .update(users)
    .set({ username: normalizedUsername, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return new Response(
    JSON.stringify({ success: true, username: normalizedUsername }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}

const handleGet = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const database = db()
  const user = await database
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  return new Response(
    JSON.stringify({ username: user[0]?.username ?? null }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}

export const Route = createFileRoute("/api/users/username")({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
})
