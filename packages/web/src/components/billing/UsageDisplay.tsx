import { useBilling } from "@flowglad/react"

const AI_REQUESTS_METER = "ai_requests"

export function UsageDisplay() {
  const billing = useBilling()

  if (!billing.loaded) {
    return null
  }

  const hasSubscription = billing.currentSubscriptions && billing.currentSubscriptions.length > 0
  const usage = billing.checkUsageBalance?.(AI_REQUESTS_METER)

  if (!hasSubscription) {
    return (
      <div className="text-xs text-zinc-500">
        Free tier: 20 requests/day
      </div>
    )
  }

  const remaining = usage?.availableBalance ?? 0
  const percentage = Math.min(100, (remaining / 1000) * 100)

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-zinc-400 tabular-nums">
        {remaining} left
      </span>
    </div>
  )
}
