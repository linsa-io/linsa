import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { getStripe, getStripeConfig } from "@/lib/stripe"
import { db } from "@/db/connection"
import { stripe_customers } from "@/db/schema"
import { eq } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/stripe/checkout")({
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
        const { archivePriceId } = getStripeConfig()

        if (!stripe) {
          console.error("[stripe] Stripe not configured - missing STRIPE_SECRET_KEY")
          return json({ error: "Stripe not configured" }, 500)
        }

        if (!archivePriceId) {
          console.error("[stripe] Price ID not configured - missing STRIPE_ARCHIVE_PRICE_ID")
          return json({ error: "Price ID not configured" }, 500)
        }

        const database = db()

        try {
          // Get or create Stripe customer
          let [customer] = await database
            .select()
            .from(stripe_customers)
            .where(eq(stripe_customers.user_id, session.user.id))
            .limit(1)

          let stripeCustomerId: string

          if (customer) {
            stripeCustomerId = customer.stripe_customer_id
          } else {
            // Create new Stripe customer
            const stripeCustomer = await stripe.customers.create({
              email: session.user.email,
              name: session.user.name ?? undefined,
              metadata: {
                user_id: session.user.id,
              },
            })

            await database.insert(stripe_customers).values({
              user_id: session.user.id,
              stripe_customer_id: stripeCustomer.id,
            })

            stripeCustomerId = stripeCustomer.id
          }

          // Parse request body for success/cancel URLs
          const body = (await request.json().catch(() => ({}))) as {
            successUrl?: string
            cancelUrl?: string
          }

          const origin = new URL(request.url).origin
          const successUrl = body.successUrl ?? `${origin}/archive?billing=success`
          const cancelUrl = body.cancelUrl ?? `${origin}/archive?billing=canceled`

          // Create checkout session
          const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            line_items: [
              {
                price: archivePriceId,
                quantity: 1,
              },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            subscription_data: {
              metadata: {
                user_id: session.user.id,
              },
            },
          })

          return json({ url: checkoutSession.url })
        } catch (error) {
          const err = error as Error
          console.error("[stripe] Checkout error:", err.message)
          return json(
            { error: `Failed to create checkout session: ${err.message}` },
            500
          )
        }
      },
    },
  },
})
