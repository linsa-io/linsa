import { createFileRoute } from "@tanstack/react-router"
import { resolveCanvasUser } from "@/lib/canvas/user-session"
import {
  deleteCanvasImage,
  getCanvasImageRecord,
  getCanvasOwner,
  updateCanvasImage,
} from "@/lib/canvas/db"

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

export const Route = createFileRoute("/api/canvas/images/$imageId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const imageId = params.imageId
          const record = await getCanvasImageRecord(imageId)
          if (!record) {
            return json({ error: "Not found" }, 404, setCookie)
          }

          const owner = await getCanvasOwner(record.canvas_id)
          if (!owner || owner.ownerId !== userId) {
            return json({ error: "Forbidden" }, 403, setCookie)
          }

          const body = await request.json().catch(() => ({}))
          const image = await updateCanvasImage({
            imageId,
            data: {
              name: typeof body.name === "string" ? body.name : undefined,
              prompt: typeof body.prompt === "string" ? body.prompt : undefined,
              modelId: typeof body.modelId === "string" ? body.modelId : undefined,
              styleId: typeof body.styleId === "string" ? body.styleId : undefined,
              position:
                body.position &&
                typeof body.position.x === "number" &&
                typeof body.position.y === "number"
                  ? { x: body.position.x, y: body.position.y }
                  : undefined,
              size:
                body.size &&
                typeof body.size.width === "number" &&
                typeof body.size.height === "number"
                  ? { width: body.size.width, height: body.size.height }
                  : undefined,
              rotation:
                typeof body.rotation === "number" && Number.isFinite(body.rotation)
                  ? body.rotation
                  : undefined,
            },
          })

          return json({ image }, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas/images/:id] PATCH", error)
          return json({ error: "Failed to update image" }, 500)
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const { userId, setCookie } = await resolveCanvasUser(request)
          const imageId = params.imageId
          const record = await getCanvasImageRecord(imageId)
          if (!record) {
            return json({ error: "Not found" }, 404, setCookie)
          }

          const owner = await getCanvasOwner(record.canvas_id)
          if (!owner || owner.ownerId !== userId) {
            return json({ error: "Forbidden" }, 403, setCookie)
          }

          await deleteCanvasImage(imageId)
          return json({ id: imageId }, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas/images/:id] DELETE", error)
          return json({ error: "Failed to delete image" }, 500)
        }
      },
    },
  },
})
