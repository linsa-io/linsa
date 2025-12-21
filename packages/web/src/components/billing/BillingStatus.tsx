import { useBilling } from "@flowglad/react"
import { UsageDisplay } from "./UsageDisplay"
import { UpgradeButton } from "./UpgradeButton"

export function BillingStatus() {
  const billing = useBilling()

  if (!billing.loaded) {
    return (
      <div className="p-4 bg-zinc-900 rounded-lg">
        <div className="animate-pulse h-4 bg-zinc-800 rounded w-24" />
      </div>
    )
  }

  const hasSubscription = billing.currentSubscriptions && billing.currentSubscriptions.length > 0

  return (
    <div className="p-4 bg-zinc-900 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white">
            {hasSubscription ? "Pro Plan" : "Free Plan"}
          </h3>
          <p className="text-sm text-zinc-400">
            {hasSubscription ? "$7.99/month" : "Limited requests"}
          </p>
        </div>
        {!hasSubscription && <UpgradeButton />}
      </div>

      {hasSubscription && (
        <>
          <UsageDisplay />
          {billing.billingPortalUrl && (
            <a
              href={billing.billingPortalUrl}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Manage subscription
            </a>
          )}
        </>
      )}
    </div>
  )
}
