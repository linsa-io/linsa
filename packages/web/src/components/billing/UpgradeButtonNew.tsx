import { useBilling } from "@flowglad/react"

const PRO_PLAN_PRICE_SLUG = "single_8_payment"

type UpgradeButtonProps = {
  className?: string
  children?: React.ReactNode
}

export function UpgradeButtonNew({ className, children }: UpgradeButtonProps) {
  const billing = useBilling()
  console.log(billing)

  const handleUpgrade = async () => {
    if (!billing.createCheckoutSession) {
      console.error("[billing] createCheckoutSession not available")
      return
    }

    try {
      await billing.createCheckoutSession({
        priceSlug: PRO_PLAN_PRICE_SLUG,
        successUrl: `${window.location.origin}/settings?billing=success`,
        cancelUrl: `${window.location.origin}/settings?billing=cancelled`,
        quantity: 1,
        autoRedirect: true,
      })
    } catch (error) {
      console.error("[billing] Checkout error:", error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      disabled={!billing.loaded}
      className={
        className ??
        "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      }
    >
      {children ?? "Buy 500 requests"}
    </button>
  )
}
