import { createFileRoute } from "@tanstack/react-router"
import {
  getCanvasOwner,
  getCanvasSnapshotById,
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

export const Route = createFileRoute("/api/canvas/$canvasId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const canvasId = params.canvasId

          const owner = await getCanvasOwner(canvasId)
          if (!owner || owner.ownerId !== userId) {
            return json({ error: "Forbidden" }, 403, setCookie)
          }

          const snapshot = await getCanvasSnapshotById(canvasId)
          if (!snapshot) {
            return json({ error: "Not found" }, 404, setCookie)
          }

          return json(snapshot, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas/:canvasId] GET", error)
          return json({ error: "Failed to load canvas" }, 500)
        }
      },
    },
  },
})
