import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { db } from "@/db/connection"
import { creator_tiers, users } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export const Route = createFileRoute("/api/creator/tiers")({
  server: {
    handlers: {
      // GET /api/creator/tiers?creator_id=xxx or ?username=xxx
      // Returns all active tiers for a creator
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const creatorId = url.searchParams.get("creator_id")
        const username = url.searchParams.get("username")

        if (!creatorId && !username) {
          return json({ error: "creator_id or username required" }, 400)
        }

        const database = db()

        try {
          let targetCreatorId = creatorId

          // Look up by username if provided
          if (username && !creatorId) {
            const user = await database.query.users.findFirst({
              where: eq(users.username, username),
            })
            if (!user) {
              return json({ error: "Creator not found" }, 404)
            }
            targetCreatorId = user.id
          }

          const tiers = await database
            .select()
            .from(creator_tiers)
            .where(
              and(
                eq(creator_tiers.creator_id, targetCreatorId!),
                eq(creator_tiers.is_active, true)
              )
            )
            .orderBy(asc(creator_tiers.sort_order), asc(creator_tiers.price_cents))

          return json({ tiers })
        } catch (error) {
          console.error("[creator/tiers] Error:", error)
          return json({ error: "Failed to fetch tiers" }, 500)
        }
      },

      // POST /api/creator/tiers - Create a new tier (creator only)
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })

        if (!session?.user?.id) {
          return json({ error: "Unauthorized" }, 401)
        }

        const body = (await request.json().catch(() => ({}))) as {
          name?: string
          description?: string
          price_cents?: number
          benefits?: string
          sort_order?: number
        }

        if (!body.name || typeof body.name !== "string") {
          return json({ error: "name is required" }, 400)
        }

        if (typeof body.price_cents !== "number" || body.price_cents < 100) {
          return json({ error: "price_cents must be at least 100 ($1)" }, 400)
        }

        const stripe = getStripe()
        const database = db()

        try {
          let stripePriceId: string | undefined

          // Create Stripe price if Stripe is configured
          if (stripe) {
            // First, get or create a product for this creator
            const productName = `${session.user.name || session.user.email} - ${body.name}`

            const product = await stripe.products.create({
              name: productName,
              metadata: {
                creator_id: session.user.id,
                tier_name: body.name,
              },
            })

            const price = await stripe.prices.create({
              product: product.id,
              unit_amount: body.price_cents,
              currency: "usd",
              recurring: { interval: "month" },
              metadata: {
                creator_id: session.user.id,
                tier_name: body.name,
              },
            })

            stripePriceId = price.id
          }

          const [tier] = await database
            .insert(creator_tiers)
            .values({
              creator_id: session.user.id,
              name: body.name.trim(),
              description: body.description?.trim() || null,
              price_cents: body.price_cents,
              benefits: body.benefits?.trim() || null,
              stripe_price_id: stripePriceId,
              sort_order: body.sort_order ?? 0,
            })
            .returning()

          return json({ tier }, 201)
        } catch (error) {
          console.error("[creator/tiers] Error creating tier:", error)
          return json({ error: "Failed to create tier" }, 500)
        }
      },
    },
  },
})
