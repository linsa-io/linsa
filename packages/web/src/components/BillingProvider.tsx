import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { authClient } from "@/lib/auth-client"

type UsageSnapshot = {
  used: number
  limit: number
  remaining: number
}

type StorageUsage = {
  archives?: UsageSnapshot
  storage?: UsageSnapshot
}

type BillingStatus = {
  isGuest: boolean
  isPaid: boolean
  planName: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  isLoading: boolean
  error?: string
  usage?: StorageUsage
}

type BillingContextValue = BillingStatus & {
  refresh: () => Promise<void>
  openCheckout: () => Promise<void>
  openPortal: () => Promise<void>
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function useBilling() {
  const context = useContext(BillingContext)
  if (!context) {
    return {
      isGuest: true,
      isPaid: false,
      planName: "Guest",
      isLoading: false,
      usage: undefined,
      refresh: async () => {},
      openCheckout: async () => {},
      openPortal: async () => {},
    } as BillingContextValue
  }
  return context
}

type BillingProviderProps = {
  children: ReactNode
}

export function BillingProvider({ children }: BillingProviderProps) {
  const { data: session, isPending } = authClient.useSession()
  const [status, setStatus] = useState<BillingStatus>({
    isGuest: true,
    isPaid: false,
    planName: "Guest",
    isLoading: true,
    usage: undefined,
  })

  const fetchBillingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/billing")
      if (response.ok) {
        const data = (await response.json()) as Partial<BillingStatus>
        setStatus({
          isGuest: data.isGuest ?? true,
          isPaid: data.isPaid ?? false,
          planName: data.planName ?? "Guest",
          usage: data.usage,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          isLoading: false,
        })
      } else {
        setStatus((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to load billing status",
        }))
      }
    } catch (error) {
      console.error("[billing] Failed to fetch status:", error)
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to load billing status",
      }))
    }
  }, [])

  useEffect(() => {
    if (isPending) return

    if (!session?.user) {
      setStatus({
        isGuest: true,
        isPaid: false,
        planName: "Guest",
        isLoading: false,
        usage: undefined,
      })
      return
    }

    fetchBillingStatus()
  }, [session?.user, isPending, fetchBillingStatus])

  const openCheckout = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/archive?billing=success`,
          cancelUrl: `${window.location.origin}/archive?billing=canceled`,
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as { url?: string }
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        console.error("[billing] Failed to create checkout session")
      }
    } catch (error) {
      console.error("[billing] Checkout error:", error)
    }
  }, [])

  const openPortal = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as { url?: string }
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        console.error("[billing] Failed to create portal session")
      }
    } catch (error) {
      console.error("[billing] Portal error:", error)
    }
  }, [])

  const value: BillingContextValue = {
    ...status,
    refresh: fetchBillingStatus,
    openCheckout,
    openPortal,
  }

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  )
}
