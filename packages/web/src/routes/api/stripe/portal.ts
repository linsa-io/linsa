import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { db } from "@/db/connection"
import { stripe_customers } from "@/db/schema"
import { eq } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/stripe/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return json({ error: "Unauthorized" }, 401)
        }

        const stripe = getStripe()
        if (!stripe) {
          return json({ error: "Stripe not configured" }, 500)
        }

        const database = db()

        try {
          // Get Stripe customer
          const [customer] = await database
            .select()
            .from(stripe_customers)
            .where(eq(stripe_customers.user_id, session.user.id))
            .limit(1)

          if (!customer) {
            return json({ error: "No billing account found" }, 404)
          }

          // Parse request body for return URL
          const body = (await request.json().catch(() => ({}))) as {
            returnUrl?: string
          }

          const origin = new URL(request.url).origin
          const returnUrl = body.returnUrl ?? `${origin}/archive`

          // Create portal session
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customer.stripe_customer_id,
            return_url: returnUrl,
          })

          return json({ url: portalSession.url })
        } catch (error) {
          console.error("[stripe] Portal error:", error)
          return json({ error: "Failed to create portal session" }, 500)
        }
      },
    },
  },
})
