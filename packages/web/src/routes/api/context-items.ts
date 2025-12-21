import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { context_items, thread_context_items } from "@/db/schema"
import { eq, and, inArray, desc } from "drizzle-orm"

interface ContextItemsBody {
  action?: string
  url?: string
  threadId?: number | string
  itemId?: number | string
}

const defaultJsonHeaders = (status: number) => ({
  status,
  headers: { "content-type": "application/json" },
})

// Fetch webpage content as markdown
async function fetchAndUpdateContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  itemId: number,
  url: string,
) {
  try {
    // Use Jina Reader API for converting webpages to markdown
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/markdown",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const content = await response.text()

    await db
      .update(context_items)
      .set({
        content,
        refreshing: false,
        updated_at: new Date(),
      })
      .where(eq(context_items.id, itemId))
  } catch (error) {
    console.error(`[fetchAndUpdateContent] Failed for ${url}:`, error)
    // Mark as not refreshing even on error
    await db
      .update(context_items)
      .set({ refreshing: false })
      .where(eq(context_items.id, itemId))
  }
}

export const Route = createFileRoute("/api/context-items")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        const database = db()
        const body = (await request.json().catch(() => ({}))) as ContextItemsBody
        const { action } = body

        try {
          switch (action) {
            case "addUrl": {
              const url = typeof body.url === "string" ? body.url.trim() : ""
              const threadId = body.threadId ? Number(body.threadId) : null

              if (!url) {
                return new Response(
                  JSON.stringify({ error: "Missing url" }),
                  defaultJsonHeaders(400),
                )
              }

              // Parse URL to get display name
              let parsedUrl: URL
              try {
                parsedUrl = new URL(url)
              } catch {
                return new Response(
                  JSON.stringify({ error: "Invalid URL" }),
                  defaultJsonHeaders(400),
                )
              }

              const name = parsedUrl.hostname + parsedUrl.pathname

              // Create context item with refreshing=true
              const [item] = await database
                .insert(context_items)
                .values({
                  user_id: session.user.id,
                  type: "url",
                  url,
                  name,
                  refreshing: true,
                })
                .returning()

              // If threadId provided, link to thread
              if (threadId) {
                await database.insert(thread_context_items).values({
                  thread_id: threadId,
                  context_item_id: item.id,
                })
              }

              // Fetch content in background and update
              fetchAndUpdateContent(database, item.id, url).catch(console.error)

              return new Response(
                JSON.stringify({ item }),
                defaultJsonHeaders(200),
              )
            }

            case "refreshUrl": {
              const itemId = Number(body.itemId)
              if (!itemId) {
                return new Response(
                  JSON.stringify({ error: "Missing itemId" }),
                  defaultJsonHeaders(400),
                )
              }

              // Verify ownership
              const [item] = await database
                .select()
                .from(context_items)
                .where(eq(context_items.id, itemId))
                .limit(1)

              if (!item || item.user_id !== session.user.id) {
                return new Response(
                  JSON.stringify({ error: "Forbidden" }),
                  defaultJsonHeaders(403),
                )
              }

              if (!item.url) {
                return new Response(
                  JSON.stringify({ error: "Item has no URL" }),
                  defaultJsonHeaders(400),
                )
              }

              // Mark as refreshing
              await database
                .update(context_items)
                .set({ refreshing: true })
                .where(eq(context_items.id, itemId))

              // Fetch content
              fetchAndUpdateContent(database, itemId, item.url).catch(console.error)

              return new Response(
                JSON.stringify({ success: true }),
                defaultJsonHeaders(200),
              )
            }

            case "deleteItem": {
              const itemId = Number(body.itemId)
              if (!itemId) {
                return new Response(
                  JSON.stringify({ error: "Missing itemId" }),
                  defaultJsonHeaders(400),
                )
              }

              // Verify ownership and delete
              await database
                .delete(context_items)
                .where(
                  and(
                    eq(context_items.id, itemId),
                    eq(context_items.user_id, session.user.id),
                  ),
                )

              return new Response(
                JSON.stringify({ success: true }),
                defaultJsonHeaders(200),
              )
            }

            case "linkToThread": {
              const itemId = Number(body.itemId)
              const threadId = Number(body.threadId)

              if (!itemId || !threadId) {
                return new Response(
                  JSON.stringify({ error: "Missing itemId/threadId" }),
                  defaultJsonHeaders(400),
                )
              }

              // Verify ownership
              const [item] = await database
                .select()
                .from(context_items)
                .where(eq(context_items.id, itemId))
                .limit(1)

              if (!item || item.user_id !== session.user.id) {
                return new Response(
                  JSON.stringify({ error: "Forbidden" }),
                  defaultJsonHeaders(403),
                )
              }

              await database
                .insert(thread_context_items)
                .values({
                  thread_id: threadId,
                  context_item_id: itemId,
                })
                .onConflictDoNothing()

              return new Response(
                JSON.stringify({ success: true }),
                defaultJsonHeaders(200),
              )
            }

            case "unlinkFromThread": {
              const itemId = Number(body.itemId)
              const threadId = Number(body.threadId)

              if (!itemId || !threadId) {
                return new Response(
                  JSON.stringify({ error: "Missing itemId/threadId" }),
                  defaultJsonHeaders(400),
                )
              }

              await database
                .delete(thread_context_items)
                .where(
                  and(
                    eq(thread_context_items.context_item_id, itemId),
                    eq(thread_context_items.thread_id, threadId),
                  ),
                )

              return new Response(
                JSON.stringify({ success: true }),
                defaultJsonHeaders(200),
              )
            }

            case "getItems": {
              const items = await database
                .select()
                .from(context_items)
                .where(eq(context_items.user_id, session.user.id))
                .orderBy(desc(context_items.created_at))

              return new Response(
                JSON.stringify({ items }),
                defaultJsonHeaders(200),
              )
            }

            case "getThreadItems": {
              const threadId = Number(body.threadId)
              if (!threadId) {
                return new Response(
                  JSON.stringify({ error: "Missing threadId" }),
                  defaultJsonHeaders(400),
                )
              }

              const links = await database
                .select()
                .from(thread_context_items)
                .where(eq(thread_context_items.thread_id, threadId))

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const itemIds = links.map((l: any) => l.context_item_id)
              if (itemIds.length === 0) {
                return new Response(
                  JSON.stringify({ items: [] }),
                  defaultJsonHeaders(200),
                )
              }

              const items = await database
                .select()
                .from(context_items)
                .where(inArray(context_items.id, itemIds))

              return new Response(
                JSON.stringify({ items }),
                defaultJsonHeaders(200),
              )
            }

            default:
              return new Response(
                JSON.stringify({ error: "Unknown action" }),
                defaultJsonHeaders(400),
              )
          }
        } catch (error) {
          console.error("[context-items] error", error)
          return new Response(
            JSON.stringify({ error: "Operation failed" }),
            defaultJsonHeaders(500),
          )
        }
      },

      GET: async ({ request }: { request: Request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        const items = await db()
          .select()
          .from(context_items)
          .where(eq(context_items.user_id, session.user.id))
          .orderBy(desc(context_items.created_at))

        return new Response(JSON.stringify({ items }), defaultJsonHeaders(200))
      },
    },
  },
})
