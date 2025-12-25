import { createFileRoute } from "@tanstack/react-router"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  })

/**
 * Stream filter configuration for nikiv
 * Stores in-memory (will connect to Jazz later)
 */

// In-memory store (will be replaced with Jazz)
let currentFilter = {
  allowedApps: ["zed", "cursor", "xcode", "safari", "warp", "warpPreview"],
  blockedApps: ["1password", "keychain"],
  audioApps: ["spotify", "arc"],
  version: 1,
  updatedAt: Date.now(),
}

export const Route = createFileRoute("/api/stream-filter")({
  server: {
    handlers: {
      GET: async () => {
        return json(currentFilter)
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { allowedApps, blockedApps, audioApps } = body

          // Update the filter
          currentFilter = {
            allowedApps: allowedApps || [],
            blockedApps: blockedApps || [],
            audioApps: audioApps || [],
            version: currentFilter.version + 1,
            updatedAt: Date.now(),
          }

          console.log(`[stream-filter] Updated config v${currentFilter.version}:`, currentFilter)

          return json({
            success: true,
            ...currentFilter,
          })
        } catch (error) {
          console.error("[stream-filter] Update failed:", error)
          return json({ error: "Failed to update filter config" }, 500)
        }
      },
    },
  },
})
