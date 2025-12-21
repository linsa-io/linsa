import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { browser_sessions, browser_session_tabs } from "@/db/schema"
import { eq, and } from "drizzle-orm"

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/browser-sessions/$sessionId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { sessionId: string }
      }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { sessionId } = params

        // Get session
        const [browserSession] = await db()
          .select()
          .from(browser_sessions)
          .where(
            and(
              eq(browser_sessions.id, sessionId),
              eq(browser_sessions.user_id, session.user.id),
            ),
          )
          .limit(1)

        if (!browserSession) {
          return jsonResponse({ error: "Session not found" }, 404)
        }

        // Get tabs
        const tabs = await db()
          .select()
          .from(browser_session_tabs)
          .where(eq(browser_session_tabs.session_id, sessionId))
          .orderBy(browser_session_tabs.position)

        return jsonResponse({ session: browserSession, tabs })
      },

      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { sessionId: string }
      }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { sessionId } = params
        const body = (await request.json().catch(() => ({}))) as {
          name?: string
          is_favorite?: boolean
        }

        // Verify ownership
        const [existing] = await db()
          .select()
          .from(browser_sessions)
          .where(
            and(
              eq(browser_sessions.id, sessionId),
              eq(browser_sessions.user_id, session.user.id),
            ),
          )
          .limit(1)

        if (!existing) {
          return jsonResponse({ error: "Session not found" }, 404)
        }

        // Build update
        const updates: Partial<{ name: string; is_favorite: boolean }> = {}
        if (body.name !== undefined) updates.name = body.name
        if (body.is_favorite !== undefined) updates.is_favorite = body.is_favorite

        if (Object.keys(updates).length === 0) {
          return jsonResponse({ error: "No updates provided" }, 400)
        }

        const [updated] = await db()
          .update(browser_sessions)
          .set(updates)
          .where(eq(browser_sessions.id, sessionId))
          .returning()

        return jsonResponse({ session: updated })
      },

      DELETE: async ({
        request,
        params,
      }: {
        request: Request
        params: { sessionId: string }
      }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const { sessionId } = params

        await db()
          .delete(browser_sessions)
          .where(
            and(
              eq(browser_sessions.id, sessionId),
              eq(browser_sessions.user_id, session.user.id),
            ),
          )

        return jsonResponse({ success: true })
      },
    },
  },
})
