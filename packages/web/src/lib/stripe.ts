import Stripe from "stripe"

type StripeEnv = {
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRO_PRICE_ID?: string // Linsa Pro subscription price ($8/month)
}

const getEnv = (): StripeEnv => {
  let STRIPE_SECRET_KEY: string | undefined
  let STRIPE_WEBHOOK_SECRET: string | undefined
  let STRIPE_PRO_PRICE_ID: string | undefined

  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: StripeEnv } } | null
    }
    const ctx = getServerContext()
    STRIPE_SECRET_KEY = ctx?.cloudflare?.env?.STRIPE_SECRET_KEY
    STRIPE_WEBHOOK_SECRET = ctx?.cloudflare?.env?.STRIPE_WEBHOOK_SECRET
    STRIPE_PRO_PRICE_ID = ctx?.cloudflare?.env?.STRIPE_PRO_PRICE_ID
  } catch {
    // Not in server context
  }

  STRIPE_SECRET_KEY = STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET =
    STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET
  STRIPE_PRO_PRICE_ID =
    STRIPE_PRO_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID

  return { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID }
}

export const getStripe = (): Stripe | null => {
  const env = getEnv()

  if (!env.STRIPE_SECRET_KEY) {
    return null
  }

  return new Stripe(env.STRIPE_SECRET_KEY)
}

export const getStripeConfig = () => {
  const env = getEnv()
  return {
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    proPriceId: env.STRIPE_PRO_PRICE_ID,
  }
}
