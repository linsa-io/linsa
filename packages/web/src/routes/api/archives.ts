import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { requireFeatureAccess } from "@/lib/access"
import { db } from "@/db/connection"
import { archives } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// GET /api/archives - List user's archives
const handleGet = async ({ request }: { request: Request }) => {
  // Check feature access
  const accessError = await requireFeatureAccess(request, "archive_view_own")
  if (accessError) return accessError

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return json({ error: "Unauthorized" }, 401)
  }

  const database = db()

  try {
    const userArchives = await database
      .select()
      .from(archives)
      .where(eq(archives.user_id, session.user.id))
      .orderBy(desc(archives.created_at))

    return json({ archives: userArchives })
  } catch (error) {
    console.error("[archives] Error fetching archives:", error)
    return json({ error: "Failed to fetch archives" }, 500)
  }
}

// POST /api/archives - Create new archive
const handlePost = async ({ request }: { request: Request }) => {
  // Check feature access
  const accessError = await requireFeatureAccess(request, "archive_create")
  if (accessError) return accessError

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return json({ error: "Unauthorized" }, 401)
  }

  const body = await request.json()
  const { title, description, type, content_url, content_text, thumbnail_url, file_size_bytes, duration_seconds, mime_type, is_public } = body as {
    title: string
    description?: string
    type: "video" | "image" | "text"
    content_url?: string
    content_text?: string
    thumbnail_url?: string
    file_size_bytes?: number
    duration_seconds?: number
    mime_type?: string
    is_public?: boolean
  }

  if (!title || !type) {
    return json({ error: "Title and type are required" }, 400)
  }

  if (!["video", "image", "text"].includes(type)) {
    return json({ error: "Type must be video, image, or text" }, 400)
  }

  const database = db()

  try {
    const [newArchive] = await database
      .insert(archives)
      .values({
        user_id: session.user.id,
        title,
        description,
        type,
        content_url,
        content_text,
        thumbnail_url,
        file_size_bytes: file_size_bytes ?? 0,
        duration_seconds,
        mime_type,
        is_public: is_public ?? false,
      })
      .returning()

    return json({ archive: newArchive }, 201)
  } catch (error) {
    console.error("[archives] Error creating archive:", error)
    return json({ error: "Failed to create archive" }, 500)
  }
}

export const Route = createFileRoute("/api/archives")({
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
