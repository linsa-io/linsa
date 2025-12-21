import { createFileRoute } from "@tanstack/react-router"
import {
  createCanvasForUser,
  getCanvasOwner,
  listCanvasesForUser,
  updateCanvasRecord,
} from "@/lib/canvas/db"
import { resolveCanvasUser } from "@/lib/canvas/user-session"

const json = (data: unknown, status = 200, setCookie?: string) => {
  const headers = new Headers({ "content-type": "application/json" })
  if (setCookie) {
    headers.set("set-cookie", setCookie)
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  })
}

export const Route = createFileRoute("/api/canvas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const canvases = await listCanvasesForUser(userId)
          return json({ canvases }, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas] GET", error)
          return json({ error: "Failed to load canvases" }, 500)
        }
      },
      POST: async ({ request }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const body = await request.json().catch(() => ({}))
          const name =
            typeof body.name === "string" && body.name.trim().length > 0
              ? body.name.trim()
              : undefined
          const snapshot = await createCanvasForUser({ userId, name })
          return json(snapshot, 201, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas] POST", error)
          return json({ error: "Failed to create canvas" }, 500)
        }
      },
      PATCH: async ({ request }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const body = await request.json().catch(() => ({}))
          const canvasId = typeof body.canvasId === "string" ? body.canvasId : null
          if (!canvasId) {
            return json({ error: "canvasId required" }, 400, setCookie)
          }

          const owner = await getCanvasOwner(canvasId)
          if (!owner || owner.ownerId !== userId) {
            return json({ error: "Forbidden" }, 403, setCookie)
          }

          const updated = await updateCanvasRecord({
            canvasId,
            data: {
              name: typeof body.name === "string" ? body.name : undefined,
              width:
                typeof body.width === "number" && Number.isFinite(body.width)
                  ? body.width
                  : undefined,
              height:
                typeof body.height === "number" && Number.isFinite(body.height)
                  ? body.height
                  : undefined,
              defaultModel:
                typeof body.defaultModel === "string" ? body.defaultModel : undefined,
              defaultStyle:
                typeof body.defaultStyle === "string" ? body.defaultStyle : undefined,
              backgroundPrompt:
                body.backgroundPrompt === null
                  ? null
                  : typeof body.backgroundPrompt === "string"
                    ? body.backgroundPrompt
                    : undefined,
            },
          })

          return json({ canvas: updated }, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas] PATCH", error)
          return json({ error: "Failed to update canvas" }, 500)
        }
      },
    },
  },
})
