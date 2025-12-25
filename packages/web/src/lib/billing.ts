import { getFlowgladServer } from "./flowglad"
import { getAuth } from "./auth"
import { db } from "@/db/connection"
import { stripe_subscriptions, storage_usage } from "@/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"

// Usage limits
const GUEST_FREE_REQUESTS = 5
const AUTH_FREE_REQUESTS_DAILY = 20
const PAID_PLAN_REQUESTS = 1000

// Usage meter slug (configure in Flowglad dashboard)
export const AI_REQUESTS_METER = "ai_requests"

// Price slug for the pro plan (configure in Flowglad dashboard)
export const PRO_PLAN_PRICE_SLUG = "pro_monthly"

type UsageCheckResult = {
  allowed: boolean
  remaining: number
  limit: number
  reason?: "guest_limit" | "daily_limit" | "subscription_limit" | "no_subscription"
  isGuest: boolean
  isPaid: boolean
}

/**
 * Check if user can make an AI request based on their billing status.
 *
 * Tiers:
 * - Guest (no auth): 5 free requests total (stored in cookie/localStorage)
 * - Authenticated free: 20 free requests per day
 * - Pro plan ($7.99/mo): 1000 requests per billing period
 */
export async function checkUsageAllowed(request: Request): Promise<UsageCheckResult> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  // Guest user - check local/cookie based limit
  if (!session?.user) {
    // For guests, we'll track on client side via localStorage
    // Server just knows they're a guest with limited access
    return {
      allowed: true, // Client will enforce limit
      remaining: GUEST_FREE_REQUESTS,
      limit: GUEST_FREE_REQUESTS,
      isGuest: true,
      isPaid: false,
    }
  }

  // Authenticated user - check Flowglad billing
  const flowglad = getFlowgladServer(request)

  if (!flowglad) {
    // Flowglad not configured, fall back to daily free limit
    return {
      allowed: true,
      remaining: AUTH_FREE_REQUESTS_DAILY,
      limit: AUTH_FREE_REQUESTS_DAILY,
      isGuest: false,
      isPaid: false,
    }
  }

  try {
    const billing = await flowglad.getBilling()

    // Check if user has an active subscription
    const hasActiveSubscription = billing.currentSubscriptions &&
      billing.currentSubscriptions.length > 0

    if (hasActiveSubscription) {
      // Check usage balance for paid plan
      const usage = billing.checkUsageBalance(AI_REQUESTS_METER)

      if (usage) {
        const remaining = usage.availableBalance
        return {
          allowed: remaining > 0,
          remaining,
          limit: PAID_PLAN_REQUESTS,
          reason: remaining <= 0 ? "subscription_limit" : undefined,
          isGuest: false,
          isPaid: true,
        }
      }

      // Has subscription but no usage meter configured yet
      return {
        allowed: true,
        remaining: PAID_PLAN_REQUESTS,
        limit: PAID_PLAN_REQUESTS,
        isGuest: false,
        isPaid: true,
      }
    }

    // No subscription - use daily free limit
    // For now we allow without tracking (TODO: implement daily limit tracking)
    return {
      allowed: true,
      remaining: AUTH_FREE_REQUESTS_DAILY,
      limit: AUTH_FREE_REQUESTS_DAILY,
      isGuest: false,
      isPaid: false,
    }
  } catch (error) {
    console.error("[billing] Error checking usage:", error)
    // On error, allow with daily limit
    return {
      allowed: true,
      remaining: AUTH_FREE_REQUESTS_DAILY,
      limit: AUTH_FREE_REQUESTS_DAILY,
      isGuest: false,
      isPaid: false,
    }
  }
}

/**
 * Record a usage event after AI request completes.
 * Only records for paid users with active subscriptions.
 */
export async function recordUsage(
  request: Request,
  amount: number = 1,
  transactionId?: string
): Promise<void> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    // Guest users don't record to Flowglad
    return
  }

  const flowglad = getFlowgladServer(request)
  if (!flowglad) {
    return
  }

  try {
    const billing = await flowglad.getBilling()

    const hasActiveSubscription = billing.currentSubscriptions &&
      billing.currentSubscriptions.length > 0

    if (!hasActiveSubscription) {
      // Only record usage for paid subscriptions
      return
    }

    const subscription = billing.currentSubscriptions![0]

    // Find the usage price for the AI requests meter
    const usagePrice = billing.pricingModel?.products
      ?.flatMap(p => p.prices || [])
      ?.find((p: { type?: string; usageMeterSlug?: string }) =>
        p.type === "usage" && p.usageMeterSlug === AI_REQUESTS_METER
      ) as { id: string } | undefined

    if (!usagePrice) {
      console.warn("[billing] No usage price found for meter:", AI_REQUESTS_METER)
      return
    }

    await flowglad.createUsageEvent({
      subscriptionId: subscription.id,
      priceId: usagePrice.id,
      amount,
      transactionId: transactionId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    })
  } catch (error) {
    console.error("[billing] Error recording usage:", error)
    // Don't throw - usage recording should not block the request
  }
}

/**
 * Get billing summary for display in UI.
 */
export async function getBillingSummary(request: Request) {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return {
      isGuest: true,
      isPaid: false,
      freeLimit: GUEST_FREE_REQUESTS,
      planName: "Guest",
    }
  }

  const flowglad = getFlowgladServer(request)
  if (!flowglad) {
    return {
      isGuest: false,
      isPaid: false,
      freeLimit: AUTH_FREE_REQUESTS_DAILY,
      planName: "Free",
    }
  }

  try {
    const billing = await flowglad.getBilling()

    const hasActiveSubscription = billing.currentSubscriptions &&
      billing.currentSubscriptions.length > 0

    if (hasActiveSubscription) {
      const usage = billing.checkUsageBalance(AI_REQUESTS_METER)
      return {
        isGuest: false,
        isPaid: true,
        remaining: usage?.availableBalance ?? PAID_PLAN_REQUESTS,
        limit: PAID_PLAN_REQUESTS,
        planName: "Pro",
        billingPortalUrl: billing.billingPortalUrl ?? undefined,
      }
    }

    return {
      isGuest: false,
      isPaid: false,
      freeLimit: AUTH_FREE_REQUESTS_DAILY,
      planName: "Free",
    }
  } catch (error) {
    console.error("[billing] Error getting summary:", error)
    return {
      isGuest: false,
      isPaid: false,
      freeLimit: AUTH_FREE_REQUESTS_DAILY,
      planName: "Free",
    }
  }
}

// =============================================================================
// Archive Storage Billing (Stripe-based)
// =============================================================================

const ARCHIVE_LIMITS = {
  free: { archives: 0, storageBytes: 0 },
  paid: { archives: 10, storageBytes: 1073741824 }, // 1GB
}

type StorageCheckResult = {
  allowed: boolean
  archivesRemaining: number
  archivesLimit: number
  bytesRemaining: number
  bytesLimit: number
  reason?: "no_subscription" | "archive_limit" | "storage_limit"
  isPaid: boolean
}

/**
 * Check if user can create a new archive (requires active Stripe subscription)
 */
export async function checkArchiveAllowed(
  request: Request,
  fileSizeBytes: number = 0
): Promise<StorageCheckResult> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return {
      allowed: false,
      archivesRemaining: 0,
      archivesLimit: 0,
      bytesRemaining: 0,
      bytesLimit: 0,
      reason: "no_subscription",
      isPaid: false,
    }
  }

  const database = db()

  try {
    // Check for active Stripe subscription
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

    if (!subscription) {
      return {
        allowed: false,
        archivesRemaining: 0,
        archivesLimit: 0,
        bytesRemaining: 0,
        bytesLimit: 0,
        reason: "no_subscription",
        isPaid: false,
      }
    }

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

    const archivesUsed = usage?.archives_used ?? 0
    const archivesLimit = usage?.archives_limit ?? ARCHIVE_LIMITS.paid.archives
    const bytesUsed = usage?.storage_bytes_used ?? 0
    const bytesLimit =
      usage?.storage_bytes_limit ?? ARCHIVE_LIMITS.paid.storageBytes

    const archivesRemaining = Math.max(0, archivesLimit - archivesUsed)
    const bytesRemaining = Math.max(0, bytesLimit - bytesUsed)

    if (archivesRemaining <= 0) {
      return {
        allowed: false,
        archivesRemaining: 0,
        archivesLimit,
        bytesRemaining,
        bytesLimit,
        reason: "archive_limit",
        isPaid: true,
      }
    }

    if (fileSizeBytes > 0 && fileSizeBytes > bytesRemaining) {
      return {
        allowed: false,
        archivesRemaining,
        archivesLimit,
        bytesRemaining,
        bytesLimit,
        reason: "storage_limit",
        isPaid: true,
      }
    }

    return {
      allowed: true,
      archivesRemaining,
      archivesLimit,
      bytesRemaining,
      bytesLimit,
      isPaid: true,
    }
  } catch (error) {
    console.error("[billing] Error checking archive allowed:", error)
    return {
      allowed: false,
      archivesRemaining: 0,
      archivesLimit: 0,
      bytesRemaining: 0,
      bytesLimit: 0,
      reason: "no_subscription",
      isPaid: false,
    }
  }
}

/**
 * Record storage usage after creating an archive
 */
export async function recordStorageUsage(
  request: Request,
  fileSizeBytes: number
): Promise<void> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return
  }

  const database = db()

  try {
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

    if (usage) {
      await database
        .update(storage_usage)
        .set({
          archives_used: usage.archives_used + 1,
          storage_bytes_used: usage.storage_bytes_used + fileSizeBytes,
          updated_at: now,
        })
        .where(eq(storage_usage.id, usage.id))

      console.log(
        `[billing] Recorded storage: +1 archive, +${fileSizeBytes} bytes`
      )
    }
  } catch (error) {
    console.error("[billing] Error recording storage usage:", error)
  }
}

/**
 * Get archive billing summary for UI display
 */
export async function getArchiveBillingSummary(request: Request) {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return {
      isGuest: true,
      isPaid: false,
      planName: "Guest",
    }
  }

  const database = db()

  try {
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

      return {
        isGuest: false,
        isPaid: true,
        planName: "Archive",
        storage: {
          archivesUsed: usage?.archives_used ?? 0,
          archivesLimit: usage?.archives_limit ?? ARCHIVE_LIMITS.paid.archives,
          bytesUsed: usage?.storage_bytes_used ?? 0,
          bytesLimit:
            usage?.storage_bytes_limit ?? ARCHIVE_LIMITS.paid.storageBytes,
        },
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    }

    return {
      isGuest: false,
      isPaid: false,
      planName: "Free",
    }
  } catch (error) {
    console.error("[billing] Error getting archive summary:", error)
    return {
      isGuest: false,
      isPaid: false,
      planName: "Free",
    }
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Check if a user has an active subscription (server-side only)
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const database = db()

  const [subscription] = await database
    .select()
    .from(stripe_subscriptions)
    .where(
      and(
        eq(stripe_subscriptions.user_id, userId),
        eq(stripe_subscriptions.status, "active")
      )
    )
    .limit(1)

  return !!subscription
}
