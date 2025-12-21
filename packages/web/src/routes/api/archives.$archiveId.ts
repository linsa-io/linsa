import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { requireFeatureAccess, hasFeatureAccess } from "@/lib/access"
import { db } from "@/db/connection"
import { archives } from "@/db/schema"
import { eq, and } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

// GET /api/archives/:archiveId - Get single archive
const handleGet = async ({
  request,
  params,
}: {
  request: Request
  params: { archiveId: string }
}) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  const database = db()

  try {
    const [archive] = await database
      .select()
      .from(archives)
      .where(eq(archives.id, params.archiveId))
      .limit(1)

    if (!archive) {
      return json({ error: "Archive not found" }, 404)
    }

    // Check access based on ownership and visibility
    const isOwner = session?.user?.id === archive.user_id

    if (isOwner) {
      // Owner can always view their own archives
      const accessError = await requireFeatureAccess(request, "archive_view_own")
      if (accessError) return accessError
    } else if (archive.is_public) {
      // Anyone can view public archives
      const hasAccess = await hasFeatureAccess(request, "archive_view_public")
      if (!hasAccess) {
        return json({ error: "Unauthorized" }, 401)
      }
    } else {
      // Private archive, not owner
      return json({ error: "Archive not found" }, 404)
    }

    return json({ archive })
  } catch (error) {
    console.error("[archives] Error fetching archive:", error)
    return json({ error: "Failed to fetch archive" }, 500)
  }
}

// PATCH /api/archives/:archiveId - Update archive
const handlePatch = async ({
  request,
  params,
}: {
  request: Request
  params: { archiveId: string }
}) => {
  const accessError = await requireFeatureAccess(request, "archive_create")
  if (accessError) return accessError

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return json({ error: "Unauthorized" }, 401)
  }

  const body = await request.json()
  const database = db()

  try {
    // Check ownership
    const [existing] = await database
      .select()
      .from(archives)
      .where(
        and(
          eq(archives.id, params.archiveId),
          eq(archives.user_id, session.user.id)
        )
      )
      .limit(1)

    if (!existing) {
      return json({ error: "Archive not found" }, 404)
    }

    // Update allowed fields
    const updateData: Partial<typeof archives.$inferInsert> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.content_url !== undefined) updateData.content_url = body.content_url
    if (body.content_text !== undefined) updateData.content_text = body.content_text
    if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url
    if (body.is_public !== undefined) updateData.is_public = body.is_public
    updateData.updated_at = new Date()

    const [updated] = await database
      .update(archives)
      .set(updateData)
      .where(eq(archives.id, params.archiveId))
      .returning()

    return json({ archive: updated })
  } catch (error) {
    console.error("[archives] Error updating archive:", error)
    return json({ error: "Failed to update archive" }, 500)
  }
}

// DELETE /api/archives/:archiveId - Delete archive
const handleDelete = async ({
  request,
  params,
}: {
  request: Request
  params: { archiveId: string }
}) => {
  const accessError = await requireFeatureAccess(request, "archive_create")
  if (accessError) return accessError

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return json({ error: "Unauthorized" }, 401)
  }

  const database = db()

  try {
    // Check ownership and delete
    const [deleted] = await database
      .delete(archives)
      .where(
        and(
          eq(archives.id, params.archiveId),
          eq(archives.user_id, session.user.id)
        )
      )
      .returning()

    if (!deleted) {
      return json({ error: "Archive not found" }, 404)
    }

    return json({ success: true })
  } catch (error) {
    console.error("[archives] Error deleting archive:", error)
    return json({ error: "Failed to delete archive" }, 500)
  }
}

export const Route = createFileRoute("/api/archives/$archiveId")({
  server: {
    handlers: {
      GET: handleGet,
      PATCH: handlePatch,
      DELETE: handleDelete,
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
})
