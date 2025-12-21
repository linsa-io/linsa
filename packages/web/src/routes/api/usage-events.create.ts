import { createFileRoute } from "@tanstack/react-router"
import { getFlowgladServer } from "@/lib/flowglad"
import { getAuth } from "@/lib/auth"

const json = (
  data: { error?: string; success?: boolean; currentBalance?: number },
  status = 200,
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/usage-events/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Check authentication
          const auth = getAuth()
          const session = await auth.api.getSession({
            headers: request.headers,
          })

          if (!session?.user) {
            return json({ error: "Unauthorized" }, 401)
          }

          // Get request body
          const body = (await request.json().catch(() => ({}))) as {
            meterSlug?: string
            amount?: number
          }
          const { meterSlug, amount } = body

          // Validate input
          if (!meterSlug || typeof meterSlug !== "string") {
            return json({ error: "meterSlug is required" }, 400)
          }

          if (!amount || typeof amount !== "number" || amount <= 0) {
            return json({ error: "amount must be a positive number" }, 400)
          }

          if (
            meterSlug !== "free_requests" &&
            meterSlug !== "premium_requests"
          ) {
            return json(
              {
                error:
                  "meterSlug must be either 'free_requests' or 'premium_requests'",
              },
              400,
            )
          }

          // Get Flowglad server instance
          const flowglad = getFlowgladServer(request)
          if (!flowglad) {
            return json({ error: "Flowglad not configured" }, 500)
          }

          // Get billing info
          const billing = await flowglad.getBilling()

          // Check if user has active subscription
          const hasActiveSubscription =
            billing.currentSubscriptions &&
            billing.currentSubscriptions.length > 0

          if (!hasActiveSubscription) {
            return json({ error: "No active subscription found" }, 400)
          }

          // Get current balance
          const balanceInfo = billing.checkUsageBalance?.(meterSlug)
          const currentBalance = balanceInfo?.availableBalance ?? 0

          // Validate balance
          if (currentBalance < amount) {
            return json(
              {
                error: `Maximum usage exceeded. Your balance is ${currentBalance}.`,
                currentBalance,
              },
              400,
            )
          }

          // Get subscription
          const subscription = billing.currentSubscriptions![0]

          // Find usage price for the meter
          const usagePrice = billing.pricingModel?.products
            ?.flatMap((p) => p.prices || [])
            ?.find((p) => p.type === "usage" && p.slug === meterSlug) as
            | { id: string }
            | undefined

          if (!usagePrice) {
            return json(
              {
                error: `No usage price found for meter: ${meterSlug}`,
              },
              400,
            )
          }

          // Create usage event
          const transactionId = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`

          await flowglad.createUsageEvent({
            subscriptionId: subscription.id,
            priceId: usagePrice.id,
            amount,
            transactionId,
          })

          return json({ success: true }, 200)
        } catch (error) {
          console.error("[api/usage-events] POST error:", error)
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Internal server error",
            },
            500,
          )
        }
      },
    },
  },
})
