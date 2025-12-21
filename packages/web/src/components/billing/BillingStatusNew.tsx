import { useBilling } from "@flowglad/react"
import { UsageDisplayNew } from "./UsageDisplayNew"
import { UpgradeButtonNew } from "./UpgradeButtonNew"
import { UsageSubmissionForm } from "./UsageSubmissionForm"

export function BillingStatusNew() {
  console.log("BillingStatusNew")
  const billing = useBilling()
  console.log(billing)
  console.log("Has currentSubscription:", "currentSubscription" in billing)

  if (!billing.loaded) {
    return (
      <div className="p-4 bg-zinc-900 rounded-lg">
        <div className="animate-pulse h-4 bg-zinc-800 rounded w-24" />
      </div>
    )
  }
  return (
    <div className="p-4 bg-zinc-900 rounded-lg space-y-3">
      <UpgradeButtonNew />
      <UsageSubmissionForm />
      <UsageDisplayNew />
    </div>
  )
}
