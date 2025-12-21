import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { browser_sessions, browser_session_tabs } from "@/db/schema"
import { eq, and, desc, ilike, or, sql } from "drizzle-orm"

interface TabInput {
  title: string
  url: string
  favicon_url?: string
}

interface SaveSessionBody {
  action: "save"
  name: string
  browser?: string
  tabs: TabInput[]
  captured_at?: string // ISO date string
}

interface ListSessionsBody {
  action: "list"
  page?: number
  limit?: number
  search?: string
}

interface GetSessionBody {
  action: "get"
  session_id: string
}

interface UpdateSessionBody {
  action: "update"
  session_id: string
  name?: string
  is_favorite?: boolean
}

interface DeleteSessionBody {
  action: "delete"
  session_id: string
}

interface SearchTabsBody {
  action: "searchTabs"
  query: string
  limit?: number
}

type RequestBody =
  | SaveSessionBody
  | ListSessionsBody
  | GetSessionBody
  | UpdateSessionBody
  | DeleteSessionBody
  | SearchTabsBody

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/browser-sessions")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const database = db()
        const body = (await request.json().catch(() => ({}))) as RequestBody

        try {
          switch (body.action) {
            case "save": {
              const { name, browser = "safari", tabs, captured_at } = body

              if (!name || !tabs || !Array.isArray(tabs)) {
                return jsonResponse({ error: "Missing name or tabs" }, 400)
              }

              // Create session
              const [newSession] = await database
                .insert(browser_sessions)
                .values({
                  user_id: session.user.id,
                  name,
                  browser,
                  tab_count: tabs.length,
                  captured_at: captured_at ? new Date(captured_at) : new Date(),
                })
                .returning()

              // Insert tabs
              if (tabs.length > 0) {
                await database.insert(browser_session_tabs).values(
                  tabs.map((tab, index) => ({
                    session_id: newSession.id,
                    title: tab.title || "",
                    url: tab.url,
                    position: index,
                    favicon_url: tab.favicon_url,
                  })),
                )
              }

              return jsonResponse({ session: newSession })
            }

            case "list": {
              const page = Math.max(1, body.page || 1)
              const limit = Math.min(100, Math.max(1, body.limit || 50))
              const offset = (page - 1) * limit
              const search = body.search?.trim()

              // Build query
              let query = database
                .select()
                .from(browser_sessions)
                .where(eq(browser_sessions.user_id, session.user.id))
                .orderBy(desc(browser_sessions.captured_at))
                .limit(limit)
                .offset(offset)

              if (search) {
                query = database
                  .select()
                  .from(browser_sessions)
                  .where(
                    and(
                      eq(browser_sessions.user_id, session.user.id),
                      ilike(browser_sessions.name, `%${search}%`),
                    ),
                  )
                  .orderBy(desc(browser_sessions.captured_at))
                  .limit(limit)
                  .offset(offset)
              }

              const sessions = await query

              // Get total count
              const [countResult] = await database
                .select({ count: sql<number>`count(*)` })
                .from(browser_sessions)
                .where(
                  search
                    ? and(
                        eq(browser_sessions.user_id, session.user.id),
                        ilike(browser_sessions.name, `%${search}%`),
                      )
                    : eq(browser_sessions.user_id, session.user.id),
                )

              const total = Number(countResult?.count || 0)

              return jsonResponse({
                sessions,
                pagination: {
                  page,
                  limit,
                  total,
                  totalPages: Math.ceil(total / limit),
                },
              })
            }

            case "get": {
              const { session_id } = body

              if (!session_id) {
                return jsonResponse({ error: "Missing session_id" }, 400)
              }

              // Get session
              const [browserSession] = await database
                .select()
                .from(browser_sessions)
                .where(
                  and(
                    eq(browser_sessions.id, session_id),
                    eq(browser_sessions.user_id, session.user.id),
                  ),
                )
                .limit(1)

              if (!browserSession) {
                return jsonResponse({ error: "Session not found" }, 404)
              }

              // Get tabs
              const tabs = await database
                .select()
                .from(browser_session_tabs)
                .where(eq(browser_session_tabs.session_id, session_id))
                .orderBy(browser_session_tabs.position)

              return jsonResponse({ session: browserSession, tabs })
            }

            case "update": {
              const { session_id, name, is_favorite } = body

              if (!session_id) {
                return jsonResponse({ error: "Missing session_id" }, 400)
              }

              // Verify ownership
              const [existing] = await database
                .select()
                .from(browser_sessions)
                .where(
                  and(
                    eq(browser_sessions.id, session_id),
                    eq(browser_sessions.user_id, session.user.id),
                  ),
                )
                .limit(1)

              if (!existing) {
                return jsonResponse({ error: "Session not found" }, 404)
              }

              // Build update
              const updates: Partial<{
                name: string
                is_favorite: boolean
              }> = {}
              if (name !== undefined) updates.name = name
              if (is_favorite !== undefined) updates.is_favorite = is_favorite

              if (Object.keys(updates).length === 0) {
                return jsonResponse({ error: "No updates provided" }, 400)
              }

              const [updated] = await database
                .update(browser_sessions)
                .set(updates)
                .where(eq(browser_sessions.id, session_id))
                .returning()

              return jsonResponse({ session: updated })
            }

            case "delete": {
              const { session_id } = body

              if (!session_id) {
                return jsonResponse({ error: "Missing session_id" }, 400)
              }

              // Delete (cascade will handle tabs)
              await database
                .delete(browser_sessions)
                .where(
                  and(
                    eq(browser_sessions.id, session_id),
                    eq(browser_sessions.user_id, session.user.id),
                  ),
                )

              return jsonResponse({ success: true })
            }

            case "searchTabs": {
              const { query, limit = 100 } = body

              if (!query?.trim()) {
                return jsonResponse({ error: "Missing query" }, 400)
              }

              const searchTerm = `%${query.trim()}%`

              // Search tabs across user's sessions
              const tabs = await database
                .select({
                  tab: browser_session_tabs,
                  session: browser_sessions,
                })
                .from(browser_session_tabs)
                .innerJoin(
                  browser_sessions,
                  eq(browser_session_tabs.session_id, browser_sessions.id),
                )
                .where(
                  and(
                    eq(browser_sessions.user_id, session.user.id),
                    or(
                      ilike(browser_session_tabs.title, searchTerm),
                      ilike(browser_session_tabs.url, searchTerm),
                    ),
                  ),
                )
                .orderBy(desc(browser_sessions.captured_at))
                .limit(Math.min(limit, 500))

              return jsonResponse({
                results: tabs.map((t) => ({
                  ...t.tab,
                  session_name: t.session.name,
                  session_captured_at: t.session.captured_at,
                })),
              })
            }

            default:
              return jsonResponse({ error: "Unknown action" }, 400)
          }
        } catch (error) {
          console.error("[browser-sessions] error", error)
          return jsonResponse({ error: "Operation failed" }, 500)
        }
      },

      GET: async ({ request }: { request: Request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const url = new URL(request.url)
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
        const limit = Math.min(
          100,
          Math.max(1, parseInt(url.searchParams.get("limit") || "50")),
        )
        const offset = (page - 1) * limit

        const sessions = await db()
          .select()
          .from(browser_sessions)
          .where(eq(browser_sessions.user_id, session.user.id))
          .orderBy(desc(browser_sessions.captured_at))
          .limit(limit)
          .offset(offset)

        const [countResult] = await db()
          .select({ count: sql<number>`count(*)` })
          .from(browser_sessions)
          .where(eq(browser_sessions.user_id, session.user.id))

        const total = Number(countResult?.count || 0)

        return jsonResponse({
          sessions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      },
    },
  },
})
