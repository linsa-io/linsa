import { createFileRoute } from "@tanstack/react-router"
import { flowglad } from "@/lib/flowglad"
import { getAuth } from "@/lib/auth"
import { findUsagePriceByMeterSlug } from "@/lib/billing-helpers"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

/**
 * POST /api/usage-events
 *
 * Creates a usage event for the current customer.
 *
 * Body: {
 *   usageMeterSlug: string;  // e.g., 'ai_requests'
 *   amount: number;          // e.g., 1
 *   transactionId?: string;  // Optional: for idempotency
 * }
 */
export const Route = createFileRoute("/api/usage-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Authenticate user
          const session = await getAuth().api.getSession({
            headers: request.headers,
          })

          if (!session?.user) {
            return json({ error: "Unauthorized" }, 401)
          }

          const userId = session.user.id

          // Parse and validate request body
          const body = await request.json().catch(() => ({}))

          const { usageMeterSlug, amount, transactionId } = body as {
            usageMeterSlug?: string
            amount?: number
            transactionId?: string
          }

          if (!usageMeterSlug || typeof usageMeterSlug !== "string") {
            return json({ error: "usageMeterSlug is required" }, 400)
          }

          if (typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
            return json({ error: "amount must be a positive integer" }, 400)
          }

          // Get Flowglad server
          const flowgladServer = flowglad(userId)
          if (!flowgladServer) {
            return json({ error: "Billing not configured" }, 500)
          }

          // Get billing info
          const billing = await flowgladServer.getBilling()

          if (!billing.customer) {
            return json({ error: "Customer not found" }, 404)
          }

          // Get current subscription
          const currentSubscription = billing.currentSubscriptions?.[0]
          if (!currentSubscription) {
            return json({ error: "No active subscription found" }, 404)
          }

          // Find usage price for the meter
          const usagePrice = findUsagePriceByMeterSlug(
            usageMeterSlug,
            billing.pricingModel,
          )

          if (!usagePrice) {
            return json(
              {
                error: `Usage price not found for meter: ${usageMeterSlug}`,
              },
              404,
            )
          }

          // Generate transaction ID if not provided (for idempotency)
          const finalTransactionId =
            transactionId ??
            `usage_${Date.now()}_${Math.random().toString(36).substring(7)}`

          // Create usage event
          const usageEvent = await flowgladServer.createUsageEvent({
            subscriptionId: currentSubscription.id,
            priceSlug: usagePrice.slug!,
            amount,
            transactionId: finalTransactionId,
          })

          return json({
            success: true,
            usageEvent,
          })
        } catch (error) {
          console.error("[usage-events] Error:", error)
          return json(
            {
              error: error instanceof Error ? error.message : "Failed to create usage event",
            },
            500,
          )
        }
      },
    },
  },
})
