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

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`)
    return parsed.href.toLowerCase().replace(/\/$/, "")
  } catch {
    return url.toLowerCase().trim()
  }
}

export const Route = createFileRoute("/api/bookmarks-add")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const body = (await request.json()) as {
            url?: string
            title?: string
            description?: string
            tags?: string
          }

          const { url, title, description, tags } = body

          if (!url) {
            return json({ error: "URL is required" }, 400)
          }

          const db = getDb(process.env.DATABASE_URL!)
          const normalizedUrl = normalizeUrl(url)

          // Check for existing bookmark with same URL
          const existing = await db
            .select()
            .from(bookmarks)
            .where(eq(bookmarks.user_id, session.user.id))

          const duplicate = existing.find(
            (b) => normalizeUrl(b.url) === normalizedUrl
          )

          if (duplicate) {
            return json(
              {
                error: "Bookmark already exists",
                existing: {
                  id: duplicate.id,
                  title: duplicate.title,
                  url: duplicate.url,
                },
              },
              409
            )
          }

          // Insert bookmark
          const [bookmark] = await db
            .insert(bookmarks)
            .values({
              user_id: session.user.id,
              url,
              title: title || null,
              description: description || null,
              tags: tags || null,
            })
            .returning()

          return json({
            success: true,
            bookmark: {
              id: bookmark.id,
              url: bookmark.url,
              title: bookmark.title,
              created_at: bookmark.created_at,
            },
          })
        } catch (error) {
          console.error("Error adding bookmark:", error)
          return json({ error: "Failed to add bookmark" }, 500)
        }
      },
    },
  },
})
