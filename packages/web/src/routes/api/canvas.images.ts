import { createFileRoute } from "@tanstack/react-router"
import { createCanvasImage, getCanvasOwner } from "@/lib/canvas/db"
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

export const Route = createFileRoute("/api/canvas/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

          const image = await createCanvasImage({
            canvasId,
            name: typeof body.name === "string" ? body.name : undefined,
            prompt: typeof body.prompt === "string" ? body.prompt : undefined,
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
            modelId: typeof body.modelId === "string" ? body.modelId : undefined,
            styleId: typeof body.styleId === "string" ? body.styleId : undefined,
            branchParentId:
              typeof body.branchParentId === "string" ? body.branchParentId : undefined,
          })

          return json({ image }, 200, setCookie)
        } catch (error) {
          if (error instanceof Response) return error
          console.error("[api/canvas/images] POST", error)
          return json({ error: "Failed to create canvas image" }, 500)
        }
      },
    },
  },
})
