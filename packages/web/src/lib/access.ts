import { getAuth } from "./auth"
import { db } from "@/db/connection"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

// User tiers
export type UserTier = "free" | "creator" | "dev"

// Features and which tiers can access them
const FEATURE_ACCESS: Record<string, UserTier[]> = {
  // Archive features - creators and devs only
  archive_create: ["creator", "dev"],
  archive_view_own: ["creator", "dev"],
  archive_view_public: ["free", "creator", "dev"], // Anyone can view public archives

  // Stream features - dev only for now
  stream_create: ["dev"],
  stream_view: ["free", "creator", "dev"],

  // Canvas - everyone
  canvas_create: ["free", "creator", "dev"],

  // Sell content - creators only
  sell_content: ["creator", "dev"],
}

export type Feature = keyof typeof FEATURE_ACCESS

/**
 * Get user's tier from database
 */
export async function getUserTier(request: Request): Promise<UserTier | null> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    return null
  }

  const database = db()

  try {
    const [user] = await database
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    return (user?.tier as UserTier) ?? "free"
  } catch (error) {
    console.error("[access] Error getting user tier:", error)
    return "free"
  }
}

/**
 * Check if user has access to a feature
 */
export async function hasFeatureAccess(
  request: Request,
  feature: Feature
): Promise<boolean> {
  const tier = await getUserTier(request)

  if (!tier) {
    // Not authenticated - only allow public features
    return FEATURE_ACCESS[feature]?.includes("free") ?? false
  }

  const allowedTiers = FEATURE_ACCESS[feature]
  if (!allowedTiers) {
    // Unknown feature - deny by default
    return false
  }

  return allowedTiers.includes(tier)
}

/**
 * Get all features user has access to
 */
export async function getUserFeatures(request: Request): Promise<Feature[]> {
  const tier = await getUserTier(request)

  if (!tier) {
    return []
  }

  return Object.entries(FEATURE_ACCESS)
    .filter(([_, tiers]) => tiers.includes(tier))
    .map(([feature]) => feature as Feature)
}

/**
 * Check access and return appropriate error response if denied
 */
export async function requireFeatureAccess(
  request: Request,
  feature: Feature
): Promise<Response | null> {
  const hasAccess = await hasFeatureAccess(request, feature)

  if (!hasAccess) {
    const tier = await getUserTier(request)

    if (!tier) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        error: "Feature not available",
        feature,
        currentTier: tier,
        requiredTiers: FEATURE_ACCESS[feature],
      }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      }
    )
  }

  return null // Access granted
}

/**
 * Upgrade user tier (admin function)
 */
export async function setUserTier(
  userId: string,
  tier: UserTier
): Promise<void> {
  const database = db()
  await database
    .update(users)
    .set({ tier, updatedAt: new Date() })
    .where(eq(users.id, userId))
}
