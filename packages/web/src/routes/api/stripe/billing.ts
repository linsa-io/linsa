import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { stripe_subscriptions, storage_usage } from "@/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/stripe/billing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })

        // Guest user
        if (!session?.user?.id) {
          return json({
            isGuest: true,
            isPaid: false,
            planName: "Guest",
          })
        }

        const database = db()

        try {
          // Check for active subscription
          const [subscription] = await database
            .select()
            .from(stripe_subscriptions)
            .where(
              and(
                eq(stripe_subscriptions.user_id, session.user.id),
                eq(stripe_subscriptions.status, "active")
              )
            )
            .limit(1)

          if (subscription) {
            // Get usage for current billing period
            const now = new Date()
            const [usage] = await database
              .select()
              .from(storage_usage)
              .where(
                and(
                  eq(storage_usage.user_id, session.user.id),
                  lte(storage_usage.period_start, now),
                  gte(storage_usage.period_end, now)
                )
              )
              .limit(1)

            return json({
              isGuest: false,
              isPaid: true,
              planName: "Archive Pro",
              usage: {
                archives: {
                  used: usage?.archives_used ?? 0,
                  limit: usage?.archives_limit ?? 10,
                  remaining: Math.max(
                    0,
                    (usage?.archives_limit ?? 10) - (usage?.archives_used ?? 0)
                  ),
                },
                storage: {
                  used: usage?.storage_bytes_used ?? 0,
                  limit: usage?.storage_bytes_limit ?? 1073741824,
                  remaining: Math.max(
                    0,
                    (usage?.storage_bytes_limit ?? 1073741824) -
                      (usage?.storage_bytes_used ?? 0)
                  ),
                },
              },
              currentPeriodEnd: subscription.current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            })
          }

          // Free authenticated user
          return json({
            isGuest: false,
            isPaid: false,
            planName: "Free",
          })
        } catch (error) {
          console.error("[billing] Error getting status:", error)
          return json({
            isGuest: false,
            isPaid: false,
            planName: "Free",
          })
        }
      },
    },
  },
})
