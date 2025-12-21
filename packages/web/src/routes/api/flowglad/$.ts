import { createFileRoute } from "@tanstack/react-router"
import { createRequestHandler } from "@flowglad/server"
import { getFlowgladServer } from "@/lib/flowglad"

const json = (data: { error?: unknown; data?: unknown }, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/flowglad/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const flowglad = getFlowgladServer(request)
        if (!flowglad) {
          return json({ error: "Flowglad not configured" }, 500)
        }

        const pathString = params._splat ?? ""
        const path = pathString.split("/").filter(Boolean)
        const url = new URL(request.url)
        const query = Object.fromEntries(url.searchParams)

        try {
          const handler = createRequestHandler({ flowgladServer: flowglad })
          const result = await handler({
            path,
            method: "GET",
            query,
          })

          return json({ error: result.error, data: result.data }, result.status)
        } catch (error) {
          console.error("[flowglad] GET error:", error)
          if (error instanceof Error && error.message === "Unauthenticated") {
            return json({ error: "Unauthorized" }, 401)
          }
          return json({ error: "Internal error" }, 500)
        }
      },
      POST: async ({ request, params }) => {
        const flowglad = getFlowgladServer(request)
        if (!flowglad) {
          return json({ error: "Flowglad not configured" }, 500)
        }

        const pathString = params._splat ?? ""
        const path = pathString.split("/").filter(Boolean)
        const body = await request.json().catch(() => ({}))

        try {
          const handler = createRequestHandler({ flowgladServer: flowglad })
          const result = await handler({
            path,
            method: "POST",
            body,
          })

          return json({ error: result.error, data: result.data }, result.status)
        } catch (error) {
          console.error("[flowglad] POST error:", error)
          if (error instanceof Error && error.message === "Unauthenticated") {
            return json({ error: "Unauthorized" }, 401)
          }
          return json({ error: "Internal error" }, 500)
        }
      },
    },
  },
})
