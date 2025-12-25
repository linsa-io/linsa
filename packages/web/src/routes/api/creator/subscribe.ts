import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { db } from "@/db/connection"
import { creator_tiers, stripe_customers } from "@/db/schema"
import { eq } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/creator/subscribe")({
  server: {
    handlers: {
      // POST /api/creator/subscribe - Start subscription checkout for a creator's tier
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })

        if (!session?.user?.id) {
          return json({ error: "Unauthorized" }, 401)
        }

        const body = (await request.json().catch(() => ({}))) as {
          tier_id?: string
          success_url?: string
          cancel_url?: string
        }

        if (!body.tier_id) {
          return json({ error: "tier_id is required" }, 400)
        }

        const stripe = getStripe()
        if (!stripe) {
          return json({ error: "Stripe not configured" }, 500)
        }

        const database = db()

        try {
          // Get the tier
          const tier = await database.query.creator_tiers.findFirst({
            where: eq(creator_tiers.id, body.tier_id),
          })

          if (!tier) {
            return json({ error: "Tier not found" }, 404)
          }

          if (!tier.stripe_price_id) {
            return json({ error: "Tier not configured for payments" }, 400)
          }

          // Prevent subscribing to own tier
          if (tier.creator_id === session.user.id) {
            return json({ error: "Cannot subscribe to your own tier" }, 400)
          }

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
            const stripeCustomer = await stripe.customers.create({
              email: session.user.email,
              name: session.user.name ?? undefined,
              metadata: { user_id: session.user.id },
            })

            await database.insert(stripe_customers).values({
              user_id: session.user.id,
              stripe_customer_id: stripeCustomer.id,
            })

            stripeCustomerId = stripeCustomer.id
          }

          // Create checkout session
          const origin = new URL(request.url).origin
          const successUrl = body.success_url ?? `${origin}/${tier.creator_id}?subscribed=true`
          const cancelUrl = body.cancel_url ?? `${origin}/${tier.creator_id}?canceled=true`

          const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: "subscription",
            line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            subscription_data: {
              metadata: {
                subscriber_id: session.user.id,
                creator_id: tier.creator_id,
                tier_id: tier.id,
              },
            },
            metadata: {
              subscriber_id: session.user.id,
              creator_id: tier.creator_id,
              tier_id: tier.id,
            },
          })

          return json({ url: checkoutSession.url })
        } catch (error) {
          console.error("[creator/subscribe] Error:", error)
          return json({ error: "Failed to create checkout session" }, 500)
        }
      },
    },
  },
})
