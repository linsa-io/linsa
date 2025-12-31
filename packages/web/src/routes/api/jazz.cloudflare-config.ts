import { createFileRoute } from "@tanstack/react-router"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/jazz/cloudflare-config")({
  server: {
    handlers: {
      // GET: Returns current Cloudflare Live Input UID
      GET: async () => {
        try {
          return json({
            liveInputUid: "bb7858eafc85de6c92963f3817477b5d",
            customerCode: "xctsztqzu046isdc",
            name: "linsa-nikiv",
            updatedAt: Date.now(),
          })
        } catch (error) {
          return json({ error: "Failed to fetch config" }, 500)
        }
      },

      // PUT: Updates Cloudflare Live Input UID
      PUT: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            liveInputUid?: string
            customerCode?: string
            name?: string
          }
          const { liveInputUid, customerCode, name } = body

          return json({
            success: true,
            liveInputUid,
            customerCode,
            name,
            updatedAt: Date.now(),
          })
        } catch (error) {
          return json({ error: "Failed to update config" }, 500)
        }
      },
    },
  },
})
