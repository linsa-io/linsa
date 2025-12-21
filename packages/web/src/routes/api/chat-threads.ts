import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import {
  optionsResponse,
  prepareElectricUrl,
  proxyElectricRequest,
} from "@/lib/electric-proxy"

// Validate user ID contains only safe characters (alphanumeric, hyphens, underscores)
const isValidUserId = (id: string): boolean => /^[a-zA-Z0-9_-]+$/.test(id)

const serve = async ({ request }: { request: Request }) => {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const userId = session.user.id
  if (!isValidUserId(userId)) {
    return new Response(JSON.stringify({ error: "Invalid user ID" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "chat_threads")
  const filter = `"user_id" = '${userId}'`
  originUrl.searchParams.set("where", filter)

  return proxyElectricRequest(originUrl, request)
}

export const Route = createFileRoute("/api/chat-threads")({
  server: {
    handlers: {
      GET: serve,
      OPTIONS: ({ request }) => optionsResponse(request),
    },
  },
})
