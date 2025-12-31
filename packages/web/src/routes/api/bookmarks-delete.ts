import { createFileRoute } from "@tanstack/react-router"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { bookmarks } from "@/db/schema"
import { getAuth } from "@/lib/auth"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/bookmarks-delete")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const url = new URL(request.url)
          const bookmarkId = url.searchParams.get("id")

          if (!bookmarkId) {
            return json({ error: "Bookmark ID is required" }, 400)
          }

          const db = getDb(process.env.DATABASE_URL!)

          // Delete only if it belongs to the user
          const [deleted] = await db
            .delete(bookmarks)
            .where(
              and(
                eq(bookmarks.id, bookmarkId),
                eq(bookmarks.user_id, session.user.id)
              )
            )
            .returning()

          if (!deleted) {
            return json({ error: "Bookmark not found" }, 404)
          }

          return json({ success: true })
        } catch (error) {
          console.error("Error deleting bookmark:", error)
          return json({ error: "Failed to delete bookmark" }, 500)
        }
      },
    },
  },
})
