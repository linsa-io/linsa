import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { api_keys } from "@/db/schema"
import { getAuth } from "@/lib/auth"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// Generate a random API key
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let key = "lk_" // linsa key prefix
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

// Hash function for API key storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const Route = createFileRoute("/api/api-keys")({
  server: {
    handlers: {
      // GET - List user's API keys (without the actual key, just metadata)
      GET: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const db = getDb(process.env.DATABASE_URL!)

          const keys = await db
            .select({
              id: api_keys.id,
              name: api_keys.name,
              last_used_at: api_keys.last_used_at,
              created_at: api_keys.created_at,
            })
            .from(api_keys)
            .where(eq(api_keys.user_id, session.user.id))
            .orderBy(api_keys.created_at)

          return json({ keys })
        } catch (error) {
          console.error("Error fetching API keys:", error)
          return json({ error: "Failed to fetch API keys" }, 500)
        }
      },

      // POST - Create a new API key
      POST: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const body = (await request.json().catch(() => ({}))) as { name?: string }
          const name = body.name || "Default"

          const db = getDb(process.env.DATABASE_URL!)

          // Generate new key
          const plainKey = generateApiKey()
          const keyHash = await hashApiKey(plainKey)

          // Insert key record
          const [keyRecord] = await db
            .insert(api_keys)
            .values({
              user_id: session.user.id,
              key_hash: keyHash,
              name,
            })
            .returning({
              id: api_keys.id,
              name: api_keys.name,
              created_at: api_keys.created_at,
            })

          // Return the plain key ONLY on creation (it won't be retrievable later)
          return json({
            key: plainKey,
            id: keyRecord.id,
            name: keyRecord.name,
            created_at: keyRecord.created_at,
          })
        } catch (error) {
          console.error("Error creating API key:", error)
          return json({ error: "Failed to create API key" }, 500)
        }
      },

      // DELETE - Revoke an API key
      DELETE: async ({ request }) => {
        try {
          const auth = getAuth()
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session?.user?.id) {
            return json({ error: "Unauthorized" }, 401)
          }

          const url = new URL(request.url)
          const keyId = url.searchParams.get("id")

          if (!keyId) {
            return json({ error: "Key ID is required" }, 400)
          }

          const db = getDb(process.env.DATABASE_URL!)

          // Delete key (only if it belongs to the user)
          const [deleted] = await db
            .delete(api_keys)
            .where(eq(api_keys.id, keyId))
            .returning()

          if (!deleted) {
            return json({ error: "Key not found" }, 404)
          }

          return json({ success: true })
        } catch (error) {
          console.error("Error deleting API key:", error)
          return json({ error: "Failed to delete API key" }, 500)
        }
      },
    },
  },
})
