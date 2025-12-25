import { createFileRoute } from "@tanstack/react-router"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/db/connection"
import { getAuth } from "@/lib/auth"
import { hasCreatorSubscription } from "@/lib/billing"
import { stream_replays, users } from "@/db/schema"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

const handleGet = async ({
  request,
  params,
}: {
  request: Request
  params: { username: string }
}) => {
  const { username } = params

  if (!username) {
    return json({ error: "Username required" }, 400)
  }

  const database = db()

  const user = await database.query.users.findFirst({
    where: eq(users.username, username),
  })

  if (!user) {
    return json({ error: "User not found" }, 404)
  }

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  // ONLY nikita@nikiv.dev can view replays
  const isNikita = session?.user?.email === "nikita@nikiv.dev"

  if (!isNikita) {
    return json(
      { error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" },
      403
    )
  }

  // Nikita can see all replays
  try {
    const replays = await database
      .select()
      .from(stream_replays)
      .where(eq(stream_replays.user_id, user.id))
      .orderBy(
        desc(stream_replays.started_at),
        desc(stream_replays.created_at)
      )
    return json({ replays })
  } catch (error) {
    console.error("[stream-replays] Error fetching replays:", error)
    return json({ error: "Failed to fetch replays" }, 500)
  }
}

export const Route = createFileRoute("/api/streams/$username/replays")({
  server: {
    handlers: {
      GET: handleGet,
    },
  },
})
