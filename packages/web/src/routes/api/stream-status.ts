import { createFileRoute } from "@tanstack/react-router"

const handler = async () => {
  try {
    const response = await fetch("https://nikiv.dev/api/stream-status", {
      cache: "no-store",
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ isLive: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const data = await response.json()

    return new Response(JSON.stringify({
      isLive: Boolean(data.isLive),
      updatedAt: data.updatedAt,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Failed to fetch stream status:", error)
    return new Response(JSON.stringify({ isLive: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/stream-status")({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
