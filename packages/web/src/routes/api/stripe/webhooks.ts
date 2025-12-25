import { createFileRoute } from "@tanstack/react-router"
import { getStripe, getStripeConfig } from "@/lib/stripe"
import { db } from "@/db/connection"
import {
  stripe_customers,
  stripe_subscriptions,
  storage_usage,
  creator_subscriptions,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type Stripe from "stripe"

// Archive subscription limits
const ARCHIVE_LIMITS = {
  archives: 10,
  storageBytes: 1073741824, // 1GB
}

export const Route = createFileRoute("/api/stripe/webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripe = getStripe()
        const { webhookSecret } = getStripeConfig()

        if (!stripe || !webhookSecret) {
          console.error("[stripe] Stripe not configured")
          return new Response("Stripe not configured", { status: 500 })
        }

        const body = await request.text()
        const signature = request.headers.get("stripe-signature")

        if (!signature) {
          return new Response("Missing stripe-signature header", { status: 400 })
        }

        let event: Stripe.Event
        try {
          event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
        } catch (err) {
          console.error("[stripe] Webhook signature verification failed:", err)
          return new Response("Invalid signature", { status: 400 })
        }

        const database = db()

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session
              console.log("[stripe] Checkout completed:", session.id)

              if (session.mode === "subscription" && session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(
                  session.subscription as string
                )
                await handleSubscriptionCreated(database, subscription)
              }
              break
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
              const subscription = event.data.object as Stripe.Subscription
              console.log(`[stripe] Subscription ${event.type}:`, subscription.id)
              await handleSubscriptionCreated(database, subscription)
              break
            }

            case "customer.subscription.deleted": {
              const subscription = event.data.object as Stripe.Subscription
              console.log("[stripe] Subscription deleted:", subscription.id)
              await handleSubscriptionDeleted(database, subscription)
              break
            }

            case "invoice.payment_succeeded": {
              const invoice = event.data.object as Stripe.Invoice
              console.log("[stripe] Invoice paid:", invoice.id)
              break
            }

            case "invoice.payment_failed": {
              const invoice = event.data.object as Stripe.Invoice
              console.log("[stripe] Invoice payment failed:", invoice.id)
              break
            }

            default:
              console.log(`[stripe] Unhandled event type: ${event.type}`)
          }

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        } catch (error) {
          console.error("[stripe] Webhook handler error:", error)
          return new Response("Webhook handler error", { status: 500 })
        }
      },
    },
  },
})

async function handleSubscriptionCreated(
  database: ReturnType<typeof db>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  const metadata = subscription.metadata || {}

  // Check if this is a creator subscription
  if (metadata.creator_id && metadata.subscriber_id && metadata.tier_id) {
    await handleCreatorSubscription(database, subscription, metadata)
    return
  }

  // Find user by Stripe customer ID
  const [customer] = await database
    .select()
    .from(stripe_customers)
    .where(eq(stripe_customers.stripe_customer_id, customerId))
    .limit(1)

  if (!customer) {
    console.error("[stripe] No customer found for:", customerId)
    return
  }

  // Upsert subscription
  const existing = await database
    .select()
    .from(stripe_subscriptions)
    .where(eq(stripe_subscriptions.stripe_subscription_id, subscription.id))
    .limit(1)

  // Period dates
  const item = subscription.items.data[0]
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : new Date()
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date(),
  }

  if (existing.length > 0) {
    await database
      .update(stripe_subscriptions)
      .set(subscriptionData)
      .where(eq(stripe_subscriptions.stripe_subscription_id, subscription.id))
  } else {
    await database.insert(stripe_subscriptions).values({
      user_id: customer.user_id,
      ...subscriptionData,
    })
  }

  // Create or update storage usage record for this billing period
  const [existingUsage] = await database
    .select()
    .from(storage_usage)
    .where(
      and(
        eq(storage_usage.user_id, customer.user_id),
        eq(storage_usage.period_start, periodStart)
      )
    )
    .limit(1)

  if (!existingUsage) {
    await database.insert(storage_usage).values({
      user_id: customer.user_id,
      archives_used: 0,
      archives_limit: ARCHIVE_LIMITS.archives,
      storage_bytes_used: 0,
      storage_bytes_limit: ARCHIVE_LIMITS.storageBytes,
      period_start: periodStart,
      period_end: periodEnd,
    })
    console.log(`[stripe] Created storage usage record for user ${customer.user_id}`)
  }

  console.log(`[stripe] Subscription synced for user ${customer.user_id}`)
}

// Handle creator economy subscriptions
async function handleCreatorSubscription(
  database: ReturnType<typeof db>,
  subscription: Stripe.Subscription,
  metadata: Record<string, string>
) {
  const { creator_id, subscriber_id, tier_id } = metadata

  // Period dates
  const item = subscription.items.data[0]
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : new Date()
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Check for existing subscription
  const existing = await database
    .select()
    .from(creator_subscriptions)
    .where(eq(creator_subscriptions.stripe_subscription_id, subscription.id))
    .limit(1)

  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date(),
  }

  if (existing.length > 0) {
    await database
      .update(creator_subscriptions)
      .set(subscriptionData)
      .where(eq(creator_subscriptions.stripe_subscription_id, subscription.id))
    console.log(`[stripe] Updated creator subscription ${subscription.id}`)
  } else {
    await database.insert(creator_subscriptions).values({
      subscriber_id,
      creator_id,
      tier_id,
      ...subscriptionData,
    })
    console.log(`[stripe] Created creator subscription: ${subscriber_id} -> ${creator_id}`)
  }
}

async function handleSubscriptionDeleted(
  database: ReturnType<typeof db>,
  subscription: Stripe.Subscription
) {
  const metadata = subscription.metadata || {}

  // Check if this is a creator subscription
  if (metadata.creator_id && metadata.subscriber_id) {
    await database
      .update(creator_subscriptions)
      .set({
        status: "canceled",
        updated_at: new Date(),
      })
      .where(eq(creator_subscriptions.stripe_subscription_id, subscription.id))
    console.log(`[stripe] Creator subscription ${subscription.id} marked as canceled`)
    return
  }

  await database
    .update(stripe_subscriptions)
    .set({
      status: "canceled",
      updated_at: new Date(),
    })
    .where(eq(stripe_subscriptions.stripe_subscription_id, subscription.id))

  console.log(`[stripe] Subscription ${subscription.id} marked as canceled`)
}
