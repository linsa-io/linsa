import { useState } from "react"
import { useBilling } from "@flowglad/react"

const FREE_METER = "free_requests"
const PAID_METER = "premium_requests"

type MeterSlug = typeof FREE_METER | typeof PAID_METER

export function UsageSubmissionForm() {
  const billing = useBilling()
  const [freeAmount, setFreeAmount] = useState(1)
  const [paidAmount, setPaidAmount] = useState(1)
  const [freeError, setFreeError] = useState("")
  const [paidError, setPaidError] = useState("")
  const [freeSuccess, setFreeSuccess] = useState("")
  const [paidSuccess, setPaidSuccess] = useState("")
  const [freeSubmitting, setFreeSubmitting] = useState(false)
  const [paidSubmitting, setPaidSubmitting] = useState(false)

  if (!billing.loaded) {
    return null
  }

  const freeBalance = billing.checkUsageBalance?.(FREE_METER)
  const paidBalance = billing.checkUsageBalance?.(PAID_METER)
  const freeRemaining = freeBalance?.availableBalance ?? 0
  const paidRemaining = paidBalance?.availableBalance ?? 0

  const handleSubmit = async (meterSlug: MeterSlug, amount: number) => {
    const isFree = meterSlug === FREE_METER
    const setError = isFree ? setFreeError : setPaidError
    const setSuccess = isFree ? setFreeSuccess : setPaidSuccess
    const setSubmitting = isFree ? setFreeSubmitting : setPaidSubmitting
    const currentBalance = isFree ? freeRemaining : paidRemaining

    // Clear previous messages
    setError("")
    setSuccess("")

    // Client-side validation
    if (amount <= 0) {
      setError("Amount must be greater than 0")
      return
    }

    if (currentBalance < amount) {
      setError(`Maximum usage exceeded. Your balance is ${currentBalance}.`)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/usage-events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meterSlug, amount }),
      })

      const data = (await response.json()) as {
        error?: string
        success?: boolean
        currentBalance?: number
      }

      if (!response.ok || data.error) {
        setError(data.error || "Failed to submit usage")
        return
      }

      // Success!
      setSuccess(
        `Successfully recorded ${amount} ${meterSlug.replace("_", " ")}`,
      )

      // Reset input to default
      if (isFree) {
        setFreeAmount(1)
      } else {
        setPaidAmount(1)
      }

      // Reload billing data to update balances
      if (billing.reload) {
        await billing.reload()
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      console.error("[UsageSubmissionForm] Error:", error)
      setError(
        error instanceof Error ? error.message : "Network error occurred",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <h4 className="text-sm font-medium text-white">Submit Usage</h4>

      {/* Free Requests Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Free Requests</label>
          <span className="text-xs text-zinc-500">
            Balance: {freeRemaining}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={freeAmount}
            onChange={(e) => {
              setFreeAmount(parseInt(e.target.value) || 1)
              setFreeError("")
            }}
            disabled={freeSubmitting}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(FREE_METER, freeAmount)}
            disabled={freeSubmitting || !billing.loaded}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {freeSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
        {freeError && <p className="text-xs text-red-400">{freeError}</p>}
        {freeSuccess && (
          <p className="text-xs text-emerald-400">{freeSuccess}</p>
        )}
      </div>

      {/* Premium Requests Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Premium Requests</label>
          <span className="text-xs text-zinc-500">
            Balance: {paidRemaining}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={paidAmount}
            onChange={(e) => {
              setPaidAmount(parseInt(e.target.value) || 1)
              setPaidError("")
            }}
            disabled={paidSubmitting}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(PAID_METER, paidAmount)}
            disabled={paidSubmitting || !billing.loaded}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paidSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
        {paidError && <p className="text-xs text-red-400">{paidError}</p>}
        {paidSuccess && (
          <p className="text-xs text-emerald-400">{paidSuccess}</p>
        )}
      </div>
    </div>
  )
}
