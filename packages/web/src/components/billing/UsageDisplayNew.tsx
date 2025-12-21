import { useBilling } from "@flowglad/react"

const FREE_METER = "free_requests"
const PAID_METER = "premium_requests"

export function UsageDisplayNew() {
  const billing = useBilling()
  console.log(billing)

  if (!billing.loaded) {
    return null
  }

  const freeUsage = billing.checkUsageBalance?.(FREE_METER)
  const paidUsage = billing.checkUsageBalance?.(PAID_METER)
  console.log(freeUsage)
  console.log(paidUsage)

  const freeRemaining = freeUsage?.availableBalance ?? 0
  const freePercentage = Math.min(100, (freeRemaining / 1000) * 100)
  const remaining = paidUsage?.availableBalance ?? 0
  const percentage = Math.min(100, (remaining / 1000) * 100)

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        Free requests
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${freePercentage}%` }}
          />
        </div>
        <span className="text-zinc-400 tabular-nums">{freeRemaining} left</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        Paid requests
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-zinc-400 tabular-nums">{remaining} left</span>
      </div>
    </>
  )
}
