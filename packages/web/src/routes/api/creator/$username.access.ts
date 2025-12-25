import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { creator_subscriptions, creator_tiers, users } from "@/db/schema"
import { eq, and } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/creator/$username/access")({
  server: {
    handlers: {
      // GET /api/creator/:username/access - Check if current user has access to creator's content
      GET: async ({ request, params }) => {
        const { username } = params

        const auth = getAuth()
        const session = await auth.api.getSession({ headers: request.headers })

        const database = db()

        // Find the creator
        const creator = await database.query.users.findFirst({
          where: eq(users.username, username),
        })

        if (!creator) {
          return json({ error: "Creator not found" }, 404)
        }

        // If user is the creator themselves, they have access
        if (session?.user?.id === creator.id) {
          return json({
            hasAccess: true,
            isOwner: true,
            subscription: null,
            tier: null,
          })
        }

        // If not logged in, no access
        if (!session?.user?.id) {
          return json({
            hasAccess: false,
            isOwner: false,
            reason: "not_authenticated",
            subscription: null,
            tier: null,
          })
        }

        // Check for active subscription to this creator
        const subscription = await database.query.creator_subscriptions.findFirst({
          where: and(
            eq(creator_subscriptions.subscriber_id, session.user.id),
            eq(creator_subscriptions.creator_id, creator.id),
            eq(creator_subscriptions.status, "active")
          ),
        })

        if (!subscription) {
          return json({
            hasAccess: false,
            isOwner: false,
            reason: "no_subscription",
            subscription: null,
            tier: null,
          })
        }

        // Get the tier info
        const tier = await database.query.creator_tiers.findFirst({
          where: eq(creator_tiers.id, subscription.tier_id),
        })

        return json({
          hasAccess: true,
          isOwner: false,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          tier: tier
            ? {
                id: tier.id,
                name: tier.name,
                benefits: tier.benefits,
              }
            : null,
        })
      },
    },
  },
})
