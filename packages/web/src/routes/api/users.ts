import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import {
  optionsResponse,
  prepareElectricUrl,
  proxyElectricRequest,
} from "@/lib/electric-proxy"

const serve = async ({ request }: { request: Request }) => {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "users")

  return proxyElectricRequest(originUrl, request)
}

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: serve,
      OPTIONS: ({ request }) => optionsResponse(request),
    },
  },
})
