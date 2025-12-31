import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { bookmarks } from "@/db/schema"
import { getAuth } from "@/lib/auth"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/bookmarks-list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const db = getDb(process.env.DATABASE_URL!)

          const userBookmarks = await db
            .select()
            .from(bookmarks)
            .where(eq(bookmarks.user_id, session.user.id))
            .orderBy(bookmarks.created_at)

          return json({ bookmarks: userBookmarks })
        } catch (error) {
          console.error("Error fetching bookmarks:", error)
          return json({ error: "Failed to fetch bookmarks" }, 500)
        }
      },
    },
  },
})
