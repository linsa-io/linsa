import { Hono, type Context, type MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import { eq } from "drizzle-orm"
import { createLogsClient, type LogPayload, type LogsWriteResult } from "@1focus/logs"
import {
  browser_session_tabs,
  browser_sessions,
  canvas,
  canvas_images,
  chat_messages,
  chat_threads,
  context_items,
  thread_context_items,
} from "../../web/src/db/schema"
import { getDb, type Hyperdrive } from "./db"

type Env = {
  ADMIN_API_KEY?: string
  DATABASE_URL?: string
  HYPERDRIVE?: Hyperdrive
  FOCUS_LOGS_API_KEY?: string
  FOCUS_LOGS_ENDPOINT?: string
  FOCUS_LOGS_SERVER?: string
}

// Create a new Hono app
type AppEnv = { Bindings: Env }
const app = new Hono<AppEnv>()

// Enable CORS for all routes
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
)

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return next()
  }

  const apiKey = c.env.ADMIN_API_KEY
  if (!apiKey) {
    return next()
  }

  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401)
  }

  const providedKey = authHeader.slice(7)
  if (providedKey !== apiKey) {
    return c.json({ error: "Invalid API key" }, 401)
  }

  return next()
}

app.use("/api/v1/admin/*", requireAdmin)

const parseBody = async (c: Context<AppEnv>) => {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const getLogsClient = (env: Env) => {
  const apiKey = env.FOCUS_LOGS_API_KEY?.trim()
  if (!apiKey) return null
  const endpoint = env.FOCUS_LOGS_ENDPOINT?.trim() || undefined
  const server = env.FOCUS_LOGS_SERVER?.trim() || "linsa"
  return createLogsClient({
    apiKey,
    server,
    endpoint,
    defaultSource: "linsa-worker",
    timeoutMs: 3000,
  })
}

const logTo1Focus = async (
  c: Context<AppEnv>,
  payload: LogPayload,
  awaitResult = false,
): Promise<LogsWriteResult | null> => {
  const client = getLogsClient(c.env)
  if (!client) return null

  const promise = client.log(payload)
  if (!awaitResult && c.executionCtx) {
    c.executionCtx.waitUntil(promise)
    return null
  }

  return promise
}

const parseInteger = (value: unknown) => {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isInteger(numberValue) ? numberValue : null
}

const parseDate = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const parsePosition = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    typeof (value as { x: unknown }).x === "number" &&
    typeof (value as { y: unknown }).y === "number"
  ) {
    return { x: (value as { x: number }).x, y: (value as { y: number }).y }
  }
  return null
}

const parseSize = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "width" in value &&
    "height" in value &&
    typeof (value as { width: unknown }).width === "number" &&
    typeof (value as { height: unknown }).height === "number"
  ) {
    return {
      width: (value as { width: number }).width,
      height: (value as { height: number }).height,
    }
  }
  return null
}

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", message: "Worker is running!" })
})

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Welcome to the Cloudflare Worker API",
    endpoints: {
      health: "/health",
      api: "/api/v1",
      admin: "/api/v1/admin",
    },
  })
})

// Example API endpoint
app.get("/api/v1/hello", (c) => {
  const name = c.req.query("name") || "World"
  void logTo1Focus(c, {
    message: "hello endpoint called",
    level: "info",
    meta: { name },
  })
  return c.json({ message: `Hello, ${name}!` })
})

// Manual log write (admin-only)
app.post("/api/v1/admin/logs", async (c) => {
  const body = await parseBody(c)
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return c.json({ error: "message is required" }, 400)
  }

  const metaInput = isRecord(body.meta) ? body.meta : {}
  const meta = {
    ...metaInput,
    path: c.req.path,
    method: c.req.method,
  }

  const payload: LogPayload = {
    message,
    level: typeof body.level === "string" ? (body.level as LogPayload["level"]) : "info",
    source: typeof body.source === "string" ? body.source : undefined,
    timestamp:
      typeof body.timestamp === "number" || typeof body.timestamp === "string"
        ? body.timestamp
        : undefined,
    meta,
    attributes: isRecord(body.attributes) ? body.attributes : undefined,
    resource: isRecord(body.resource) ? body.resource : undefined,
    scope: isRecord(body.scope) ? body.scope : undefined,
    traceId: typeof body.traceId === "string" ? body.traceId : undefined,
    spanId: typeof body.spanId === "string" ? body.spanId : undefined,
    parentSpanId: typeof body.parentSpanId === "string" ? body.parentSpanId : undefined,
    traceFlags: typeof body.traceFlags === "number" ? body.traceFlags : undefined,
  }

  const result = await logTo1Focus(c, payload, true)
  if (!result) {
    return c.json({ error: "Logging not configured" }, 503)
  }

  return c.json({ result }, result.ok ? 200 : 502)
})

// Canvas endpoints
app.post("/api/v1/admin/canvas", async (c) => {
  const body = await parseBody(c)
  const ownerId = typeof body.ownerId === "string" ? body.ownerId.trim() : ""
  if (!ownerId) {
    return c.json({ error: "ownerId required" }, 400)
  }

  const values: typeof canvas.$inferInsert = {
    owner_id: ownerId,
  }

  if (typeof body.name === "string" && body.name.trim()) {
    values.name = body.name.trim()
  }
  if (typeof body.width === "number" && Number.isFinite(body.width)) {
    values.width = body.width
  }
  if (typeof body.height === "number" && Number.isFinite(body.height)) {
    values.height = body.height
  }
  if (typeof body.defaultModel === "string") {
    values.default_model = body.defaultModel
  }
  if (typeof body.defaultStyle === "string") {
    values.default_style = body.defaultStyle
  }
  if (body.backgroundPrompt === null) {
    values.background_prompt = null
  } else if (typeof body.backgroundPrompt === "string") {
    values.background_prompt = body.backgroundPrompt
  }

  try {
    const database = getDb(c.env)
    const [record] = await database.insert(canvas).values(values).returning()
    return c.json({ canvas: record }, 201)
  } catch (error) {
    console.error("[worker] create canvas failed", error)
    return c.json({ error: "Failed to create canvas" }, 500)
  }
})

app.patch("/api/v1/admin/canvas/:canvasId", async (c) => {
  const canvasId = c.req.param("canvasId")
  if (!canvasId) {
    return c.json({ error: "canvasId required" }, 400)
  }

  const body = await parseBody(c)
  const updates: Partial<typeof canvas.$inferInsert> = {
    updated_at: new Date(),
  }

  if (typeof body.name === "string") {
    updates.name = body.name
  }
  if (typeof body.width === "number" && Number.isFinite(body.width)) {
    updates.width = body.width
  }
  if (typeof body.height === "number" && Number.isFinite(body.height)) {
    updates.height = body.height
  }
  if (typeof body.defaultModel === "string") {
    updates.default_model = body.defaultModel
  }
  if (typeof body.defaultStyle === "string") {
    updates.default_style = body.defaultStyle
  }
  if (body.backgroundPrompt === null) {
    updates.background_prompt = null
  } else if (typeof body.backgroundPrompt === "string") {
    updates.background_prompt = body.backgroundPrompt
  }

  if (Object.keys(updates).length <= 1) {
    return c.json({ error: "No updates provided" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [record] = await database
      .update(canvas)
      .set(updates)
      .where(eq(canvas.id, canvasId))
      .returning()
    if (!record) {
      return c.json({ error: "Canvas not found" }, 404)
    }
    return c.json({ canvas: record })
  } catch (error) {
    console.error("[worker] update canvas failed", error)
    return c.json({ error: "Failed to update canvas" }, 500)
  }
})

app.post("/api/v1/admin/canvas/:canvasId/images", async (c) => {
  const canvasId = c.req.param("canvasId")
  if (!canvasId) {
    return c.json({ error: "canvasId required" }, 400)
  }

  const body = await parseBody(c)
  const position = parsePosition(body.position)
  const size = parseSize(body.size)

  const values: typeof canvas_images.$inferInsert = {
    canvas_id: canvasId,
  }

  if (typeof body.name === "string") values.name = body.name
  if (typeof body.prompt === "string") values.prompt = body.prompt
  if (typeof body.modelId === "string") values.model_id = body.modelId
  if (typeof body.modelUsed === "string") values.model_used = body.modelUsed
  if (typeof body.styleId === "string") values.style_id = body.styleId
  if (typeof body.rotation === "number" && Number.isFinite(body.rotation)) {
    values.rotation = body.rotation
  }
  if (position) values.position = position
  if (size) {
    values.width = size.width
    values.height = size.height
  }
  if (body.metadata !== undefined) {
    values.metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : null
  }
  if (body.branchParentId === null) {
    values.branch_parent_id = null
  } else if (typeof body.branchParentId === "string") {
    values.branch_parent_id = body.branchParentId
  }
  if (body.contentBase64 === null) {
    values.content_base64 = null
  } else if (typeof body.contentBase64 === "string") {
    values.content_base64 = body.contentBase64
  } else if (typeof body.content_base64 === "string") {
    values.content_base64 = body.content_base64
  }
  if (body.imageUrl === null) {
    values.image_url = null
  } else if (typeof body.imageUrl === "string") {
    values.image_url = body.imageUrl
  }

  try {
    const database = getDb(c.env)
    const [image] = await database.insert(canvas_images).values(values).returning()
    return c.json({ image }, 201)
  } catch (error) {
    console.error("[worker] create canvas image failed", error)
    return c.json({ error: "Failed to create canvas image" }, 500)
  }
})

app.patch("/api/v1/admin/canvas/images/:imageId", async (c) => {
  const imageId = c.req.param("imageId")
  if (!imageId) {
    return c.json({ error: "imageId required" }, 400)
  }

  const body = await parseBody(c)
  const updates: Partial<typeof canvas_images.$inferInsert> = {
    updated_at: new Date(),
  }
  const position = parsePosition(body.position)
  const size = parseSize(body.size)

  if (typeof body.name === "string") updates.name = body.name
  if (typeof body.prompt === "string") updates.prompt = body.prompt
  if (typeof body.modelId === "string") updates.model_id = body.modelId
  if (typeof body.modelUsed === "string") updates.model_used = body.modelUsed
  if (typeof body.styleId === "string") updates.style_id = body.styleId
  if (typeof body.rotation === "number" && Number.isFinite(body.rotation)) {
    updates.rotation = body.rotation
  }
  if (position) updates.position = position
  if (size) {
    updates.width = size.width
    updates.height = size.height
  }
  if (body.metadata !== undefined) {
    updates.metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : null
  }
  if (body.branchParentId === null) {
    updates.branch_parent_id = null
  } else if (typeof body.branchParentId === "string") {
    updates.branch_parent_id = body.branchParentId
  }
  if (body.contentBase64 === null) {
    updates.content_base64 = null
  } else if (typeof body.contentBase64 === "string") {
    updates.content_base64 = body.contentBase64
  } else if (typeof body.content_base64 === "string") {
    updates.content_base64 = body.content_base64
  }
  if (body.imageUrl === null) {
    updates.image_url = null
  } else if (typeof body.imageUrl === "string") {
    updates.image_url = body.imageUrl
  }

  if (Object.keys(updates).length <= 1) {
    return c.json({ error: "No updates provided" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [image] = await database
      .update(canvas_images)
      .set(updates)
      .where(eq(canvas_images.id, imageId))
      .returning()
    if (!image) {
      return c.json({ error: "Image not found" }, 404)
    }
    return c.json({ image })
  } catch (error) {
    console.error("[worker] update canvas image failed", error)
    return c.json({ error: "Failed to update canvas image" }, 500)
  }
})

app.delete("/api/v1/admin/canvas/images/:imageId", async (c) => {
  const imageId = c.req.param("imageId")
  if (!imageId) {
    return c.json({ error: "imageId required" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [deleted] = await database
      .delete(canvas_images)
      .where(eq(canvas_images.id, imageId))
      .returning()
    if (!deleted) {
      return c.json({ error: "Image not found" }, 404)
    }
    return c.json({ id: imageId })
  } catch (error) {
    console.error("[worker] delete canvas image failed", error)
    return c.json({ error: "Failed to delete canvas image" }, 500)
  }
})

// Chat endpoints
app.post("/api/v1/admin/chat/threads", async (c) => {
  const body = await parseBody(c)
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New chat"
  const userId = typeof body.userId === "string" ? body.userId : null

  try {
    const database = getDb(c.env)
    const [thread] = await database
      .insert(chat_threads)
      .values({ title, user_id: userId })
      .returning()
    return c.json({ thread }, 201)
  } catch (error) {
    console.error("[worker] create thread failed", error)
    return c.json({ error: "Failed to create thread" }, 500)
  }
})

app.patch("/api/v1/admin/chat/threads/:threadId", async (c) => {
  const threadId = parseInteger(c.req.param("threadId"))
  if (!threadId) {
    return c.json({ error: "threadId required" }, 400)
  }

  const body = await parseBody(c)
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title) {
    return c.json({ error: "title required" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [thread] = await database
      .update(chat_threads)
      .set({ title })
      .where(eq(chat_threads.id, threadId))
      .returning()
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404)
    }
    return c.json({ thread })
  } catch (error) {
    console.error("[worker] update thread failed", error)
    return c.json({ error: "Failed to update thread" }, 500)
  }
})

app.post("/api/v1/admin/chat/messages", async (c) => {
  const body = await parseBody(c)
  const threadId = parseInteger(body.threadId)
  const role = typeof body.role === "string" ? body.role.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const createdAt = parseDate(body.createdAt)

  if (!threadId || !role || !content) {
    return c.json({ error: "threadId, role, and content are required" }, 400)
  }

  try {
    const database = getDb(c.env)
    const values: typeof chat_messages.$inferInsert = {
      thread_id: threadId,
      role,
      content,
    }
    if (createdAt) {
      values.created_at = createdAt
    }
    const [message] = await database
      .insert(chat_messages)
      .values(values)
      .returning()
    return c.json({ message }, 201)
  } catch (error) {
    console.error("[worker] add message failed", error)
    return c.json({ error: "Failed to add message" }, 500)
  }
})

// Context items endpoints
app.post("/api/v1/admin/context-items", async (c) => {
  const body = await parseBody(c)
  const userId = typeof body.userId === "string" ? body.userId.trim() : ""
  const type =
    typeof body.type === "string" ? body.type.trim().toLowerCase() : ""
  const url = typeof body.url === "string" ? body.url.trim() : null
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : url
        ? (() => {
            try {
              const parsed = new URL(url)
              return `${parsed.hostname}${parsed.pathname}`
            } catch {
              return url
            }
          })()
        : "Untitled context"
  const threadId = parseInteger(body.threadId)
  const parentId = parseInteger(body.parentId)

  if (!userId) {
    return c.json({ error: "userId required" }, 400)
  }
  if (type !== "url" && type !== "file") {
    return c.json({ error: "type must be 'url' or 'file'" }, 400)
  }

  const values: typeof context_items.$inferInsert = {
    user_id: userId,
    type,
    name,
  }

  if (url) values.url = url
  if (body.content === null) {
    values.content = null
  } else if (typeof body.content === "string") {
    values.content = body.content
  }
  if (typeof body.refreshing === "boolean") {
    values.refreshing = body.refreshing
  }
  if (parentId) {
    values.parent_id = parentId
  }

  try {
    const database = getDb(c.env)
    const [item] = await database.insert(context_items).values(values).returning()

    if (threadId) {
      await database.insert(thread_context_items).values({
        thread_id: threadId,
        context_item_id: item.id,
      })
    }

    return c.json({ item }, 201)
  } catch (error) {
    console.error("[worker] create context item failed", error)
    return c.json({ error: "Failed to create context item" }, 500)
  }
})

app.patch("/api/v1/admin/context-items/:itemId", async (c) => {
  const itemId = parseInteger(c.req.param("itemId"))
  if (!itemId) {
    return c.json({ error: "itemId required" }, 400)
  }

  const body = await parseBody(c)
  const updates: Partial<typeof context_items.$inferInsert> = {
    updated_at: new Date(),
  }
  const parentId = parseInteger(body.parentId)

  if (typeof body.name === "string") updates.name = body.name
  if (typeof body.type === "string") {
    const nextType = body.type.trim().toLowerCase()
    if (nextType !== "url" && nextType !== "file") {
      return c.json({ error: "type must be 'url' or 'file'" }, 400)
    }
    updates.type = nextType
  }
  if (body.url === null) {
    updates.url = null
  } else if (typeof body.url === "string") {
    updates.url = body.url
  }
  if (body.content === null) {
    updates.content = null
  } else if (typeof body.content === "string") {
    updates.content = body.content
  }
  if (typeof body.refreshing === "boolean") {
    updates.refreshing = body.refreshing
  }
  if (body.parentId === null) {
    updates.parent_id = null
  } else if (parentId) {
    updates.parent_id = parentId
  }

  if (Object.keys(updates).length <= 1) {
    return c.json({ error: "No updates provided" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [item] = await database
      .update(context_items)
      .set(updates)
      .where(eq(context_items.id, itemId))
      .returning()
    if (!item) {
      return c.json({ error: "Context item not found" }, 404)
    }
    return c.json({ item })
  } catch (error) {
    console.error("[worker] update context item failed", error)
    return c.json({ error: "Failed to update context item" }, 500)
  }
})

app.post("/api/v1/admin/context-items/:itemId/link", async (c) => {
  const itemId = parseInteger(c.req.param("itemId"))
  if (!itemId) {
    return c.json({ error: "itemId required" }, 400)
  }

  const body = await parseBody(c)
  const threadId = parseInteger(body.threadId)
  if (!threadId) {
    return c.json({ error: "threadId required" }, 400)
  }

  try {
    const database = getDb(c.env)
    await database.insert(thread_context_items).values({
      thread_id: threadId,
      context_item_id: itemId,
    })
    return c.json({ success: true })
  } catch (error) {
    console.error("[worker] link context item failed", error)
    return c.json({ error: "Failed to link context item" }, 500)
  }
})

app.delete("/api/v1/admin/context-items/:itemId", async (c) => {
  const itemId = parseInteger(c.req.param("itemId"))
  if (!itemId) {
    return c.json({ error: "itemId required" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [item] = await database
      .delete(context_items)
      .where(eq(context_items.id, itemId))
      .returning()
    if (!item) {
      return c.json({ error: "Context item not found" }, 404)
    }
    return c.json({ id: itemId })
  } catch (error) {
    console.error("[worker] delete context item failed", error)
    return c.json({ error: "Failed to delete context item" }, 500)
  }
})

// Browser session endpoints
app.post("/api/v1/admin/browser-sessions", async (c) => {
  const body = await parseBody(c)
  const userId = typeof body.userId === "string" ? body.userId.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const browser = typeof body.browser === "string" ? body.browser.trim() : "safari"
  const capturedAt = parseDate(body.capturedAt)
  const isFavorite = typeof body.isFavorite === "boolean" ? body.isFavorite : undefined
  const tabs = Array.isArray(body.tabs) ? body.tabs : []

  if (!userId || !name) {
    return c.json({ error: "userId and name are required" }, 400)
  }

  const tabValues = tabs
    .map((tab) => {
      if (!tab || typeof tab !== "object") {
        return null
      }
      const title = typeof (tab as { title?: unknown }).title === "string"
        ? (tab as { title: string }).title
        : ""
      const url = typeof (tab as { url?: unknown }).url === "string"
        ? (tab as { url: string }).url
        : ""
      if (!url) {
        return null
      }
      const faviconUrl =
        typeof (tab as { faviconUrl?: unknown }).faviconUrl === "string"
          ? (tab as { faviconUrl: string }).faviconUrl
          : typeof (tab as { favicon_url?: unknown }).favicon_url === "string"
            ? (tab as { favicon_url: string }).favicon_url
            : null
      return { title, url, favicon_url: faviconUrl }
    })
    .filter((tab): tab is { title: string; url: string; favicon_url: string | null } =>
      Boolean(tab),
    )

  try {
    const database = getDb(c.env)
    const [session] = await database
      .insert(browser_sessions)
      .values({
        user_id: userId,
        name,
        browser,
        tab_count: tabValues.length,
        is_favorite: isFavorite ?? false,
        captured_at: capturedAt ?? new Date(),
      })
      .returning()

    if (tabValues.length > 0) {
      await database.insert(browser_session_tabs).values(
        tabValues.map((tab, index) => ({
          session_id: session.id,
          title: tab.title,
          url: tab.url,
          position: index,
          favicon_url: tab.favicon_url ?? null,
        })),
      )
    }

    return c.json({ session }, 201)
  } catch (error) {
    console.error("[worker] create browser session failed", error)
    return c.json({ error: "Failed to create browser session" }, 500)
  }
})

app.patch("/api/v1/admin/browser-sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId")
  if (!sessionId) {
    return c.json({ error: "sessionId required" }, 400)
  }

  const body = await parseBody(c)
  const updates: Partial<typeof browser_sessions.$inferInsert> = {}

  if (typeof body.name === "string") updates.name = body.name
  if (typeof body.isFavorite === "boolean") updates.is_favorite = body.isFavorite

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No updates provided" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [session] = await database
      .update(browser_sessions)
      .set(updates)
      .where(eq(browser_sessions.id, sessionId))
      .returning()
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }
    return c.json({ session })
  } catch (error) {
    console.error("[worker] update browser session failed", error)
    return c.json({ error: "Failed to update browser session" }, 500)
  }
})

app.delete("/api/v1/admin/browser-sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId")
  if (!sessionId) {
    return c.json({ error: "sessionId required" }, 400)
  }

  try {
    const database = getDb(c.env)
    const [session] = await database
      .delete(browser_sessions)
      .where(eq(browser_sessions.id, sessionId))
      .returning()
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }
    return c.json({ id: sessionId })
  } catch (error) {
    console.error("[worker] delete browser session failed", error)
    return c.json({ error: "Failed to delete browser session" }, 500)
  }
})

// Export the Hono app as default (handles HTTP requests)
export default app

// Export the RPC worker for RPC calls via service bindings
export { WorkerRpc } from "./rpc"
