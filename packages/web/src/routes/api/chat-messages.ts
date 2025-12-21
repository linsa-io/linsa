import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import {
  optionsResponse,
  prepareElectricUrl,
  proxyElectricRequest,
} from "@/lib/electric-proxy"
import { db } from "@/db/connection"

const serve = async ({ request }: { request: Request }) => {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  // Get user's thread IDs first
  const userThreads = await db().query.chat_threads.findMany({
    where(fields, { eq }) {
      return eq(fields.user_id, session.user.id)
    },
    columns: { id: true },
  })

  // threadIds are integers from DB, but validate for safety
  const threadIds = userThreads
    .map((t) => t.id)
    .filter((id): id is number => Number.isInteger(id))

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "chat_messages")

  // Filter messages by user's thread IDs (no subquery)
  if (threadIds.length > 0) {
    originUrl.searchParams.set(
      "where",
      `"thread_id" IN (${threadIds.join(",")})`,
    )
  } else {
    // User has no threads, return empty by filtering impossible condition
    originUrl.searchParams.set("where", `"thread_id" = -1`)
  }

  return proxyElectricRequest(originUrl, request)
}

export const Route = createFileRoute("/api/chat-messages")({
  server: {
    handlers: {
      GET: serve,
      OPTIONS: ({ request }) => optionsResponse(request),
    },
  },
})
