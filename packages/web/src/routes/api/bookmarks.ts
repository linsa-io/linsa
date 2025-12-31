import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { api_keys, bookmarks, users } from "@/db/schema"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Hash function for API key verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Get user from API key
async function getUserFromApiKey(apiKey: string) {
  const db = getDb(process.env.DATABASE_URL!)
  const keyHash = await hashApiKey(apiKey)

  const [keyRecord] = await db
    .select({
      userId: api_keys.user_id,
      keyId: api_keys.id,
    })
    .from(api_keys)
    .where(eq(api_keys.key_hash, keyHash))
    .limit(1)

  if (!keyRecord) return null

  // Update last_used_at
  await db
    .update(api_keys)
    .set({ last_used_at: new Date() })
    .where(eq(api_keys.id, keyRecord.keyId))

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, keyRecord.userId))
    .limit(1)

  return user || null
}

export const Route = createFileRoute("/api/bookmarks")({
  server: {
    handlers: {
      // POST - Add a bookmark
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            url?: string
            title?: string
            description?: string
            tags?: string
            api_key?: string
          }
          const { url, title, description, tags, api_key } = body

          if (!url) {
            return json({ error: "URL is required" }, 400)
          }

          if (!api_key) {
            return json({ error: "API key is required" }, 401)
          }

          const user = await getUserFromApiKey(api_key)
          if (!user) {
            return json({ error: "Invalid API key" }, 401)
          }

          const db = getDb(process.env.DATABASE_URL!)

          // Insert bookmark
          const [bookmark] = await db
            .insert(bookmarks)
            .values({
              user_id: user.id,
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

      // GET - List bookmarks (requires API key in header)
      GET: async ({ request }) => {
        try {
          const apiKey = request.headers.get("x-api-key")

          if (!apiKey) {
            return json({ error: "API key is required" }, 401)
          }

          const user = await getUserFromApiKey(apiKey)
          if (!user) {
            return json({ error: "Invalid API key" }, 401)
          }

          const db = getDb(process.env.DATABASE_URL!)

          const userBookmarks = await db
            .select()
            .from(bookmarks)
            .where(eq(bookmarks.user_id, user.id))
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
