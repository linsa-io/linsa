import { FlowgladProvider } from "@flowglad/react"
import { authClient } from "@/lib/auth-client"

type BillingProviderProps = {
  children: React.ReactNode
}

export function BillingProvider({ children }: BillingProviderProps) {
  const flowgladEnabled = import.meta.env.VITE_FLOWGLAD_ENABLED === "true"

  // Skip billing entirely when Flowglad isn't configured
  if (!flowgladEnabled) {
    return <>{children}</>
  }

  const { data: session, isPending } = authClient.useSession()

  // Don't load billing until we know auth state
  if (isPending) {
    return <>{children}</>
  }

  return (
    <FlowgladProvider loadBilling={!!session?.user} serverRoute="/api/flowglad">
      {children}
    </FlowgladProvider>
  )
}
