// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BillingWithChecks = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Price = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UsageMeter = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any

/**
 * Computes the total usage credits for a given usage meter slug from the current subscription's feature items.
 */
export function computeUsageTotal(
  usageMeterSlug: string,
  currentSubscription:
    | NonNullable<NonNullable<BillingWithChecks["currentSubscriptions"]>[number]>
    | undefined,
  pricingModel: BillingWithChecks["pricingModel"] | undefined,
): number {
  try {
    if (!currentSubscription || !pricingModel?.usageMeters) return 0

    const experimental = currentSubscription.experimental as
      | { featureItems?: Array<{ type: string; usageMeterId: string; amount: number }> }
      | undefined
    const featureItems = experimental?.featureItems ?? []

    if (featureItems.length === 0) return 0

    // Build lookup map: usageMeterId -> slug
    const usageMeterById: Record<string, string> = {}
    for (const meter of pricingModel.usageMeters) {
      usageMeterById[String(meter.id)] = String(meter.slug)
    }

    // Sum up usage credits for matching meter
    let total = 0
    for (const item of featureItems) {
      if (item.type !== "usage_credit_grant") continue
      const meterSlug = usageMeterById[item.usageMeterId]
      if (meterSlug === usageMeterSlug) {
        total += item.amount
      }
    }

    return total
  } catch {
    return 0
  }
}

/**
 * Finds a usage meter by its slug from the pricing model.
 */
export function findUsageMeterBySlug(
  usageMeterSlug: string,
  pricingModel: BillingWithChecks["pricingModel"] | undefined,
): { id: string; slug: string } | null {
  if (!pricingModel?.usageMeters) return null

  const usageMeter = pricingModel.usageMeters.find(
    (meter: UsageMeter) => meter.slug === usageMeterSlug,
  )

  if (!usageMeter) return null

  return {
    id: String(usageMeter.id),
    slug: String(usageMeter.slug),
  }
}

/**
 * Finds a usage price by its associated usage meter slug from the pricing model.
 */
export function findUsagePriceByMeterSlug(
  usageMeterSlug: string,
  pricingModel: BillingWithChecks["pricingModel"] | undefined,
): Price | null {
  if (!pricingModel?.products || !pricingModel?.usageMeters) return null

  // Build lookup map: slug -> id
  const meterIdBySlug = new Map(
    pricingModel.usageMeters.map((meter: UsageMeter) => [meter.slug, meter.id]),
  )

  const usageMeterId = meterIdBySlug.get(usageMeterSlug)
  if (!usageMeterId) return null

  // Find price by meter ID
  const usagePrice = pricingModel.products
    .flatMap((product: Product) => product.prices ?? [])
    .find(
      (price: Price) => price.type === "usage" && price.usageMeterId === usageMeterId,
    )

  return usagePrice ?? null
}

/**
 * Checks if a plan is a default (free) plan by looking up the price by slug.
 */
export function isDefaultPlanBySlug(
  pricingModel: BillingWithChecks["pricingModel"] | null | undefined,
  priceSlug: string | undefined,
): boolean {
  if (!pricingModel?.products || !priceSlug) return false

  for (const product of pricingModel.products) {
    const price = product.prices?.find((p: Price) => p.slug === priceSlug)
    if (price) {
      return product.default === true
    }
  }
  return false
}
