import { useBilling } from "@flowglad/react"

export function RegularPlanButton() {
  const { createCheckoutSession, loaded, errors } = useBilling()

  if (!loaded || !createCheckoutSession) {
    return <button type="button" disabled className="opacity-50" />
  }

  if (errors) {
    return <p>Unable to load checkout right now.</p>
  }

  const handlePurchase = async () => {
    await createCheckoutSession({
      priceSlug: "",
      quantity: 1,
      successUrl: `${window.location.origin}/billing/success`,
      cancelUrl: `${window.location.origin}/billing/cancel`,
      autoRedirect: true,
    })
  }

  return <button onClick={handlePurchase}>Buy now</button>
}
