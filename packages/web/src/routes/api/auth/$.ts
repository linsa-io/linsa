import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log("[api/auth] GET request:", request.url)
        try {
          const auth = getAuth()
          console.log("[api/auth] Auth instance created")
          const response = await auth.handler(request)
          console.log("[api/auth] Response status:", response.status)
          // Log response body for debugging
          if (response.status >= 400) {
            const cloned = response.clone()
            const body = await cloned.text()
            console.log("[api/auth] Error response body:", body)
          }
          return response
        } catch (error) {
          console.error("[api/auth] GET error:", error)
          console.error("[api/auth] GET error stack:", error instanceof Error ? error.stack : "no stack")
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }
      },
      POST: async ({ request }) => {
        const url = new URL(request.url)
        console.log("[api/auth] POST request:", url.pathname)

        // Clone request to read body for logging
        const clonedReq = request.clone()
        try {
          const bodyText = await clonedReq.text()
          console.log("[api/auth] POST body:", bodyText)
        } catch {
          console.log("[api/auth] Could not read body")
        }

        try {
          const auth = getAuth()
          console.log("[api/auth] Auth instance created, calling handler...")
          const response = await auth.handler(request)
          console.log("[api/auth] Response status:", response.status)

          // Log response body for debugging
          if (response.status >= 400) {
            const cloned = response.clone()
            const body = await cloned.text()
            console.log("[api/auth] Error response body:", body)
          }
          return response
        } catch (error) {
          console.error("[api/auth] POST error:", error)
          console.error("[api/auth] POST error stack:", error instanceof Error ? error.stack : "no stack")
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }
      },
    },
  },
})
