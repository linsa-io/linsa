import { JazzReactProvider } from "jazz-tools/react"
import { ViewerAccount } from "./schema"

// Jazz Cloud API key - using public demo key for now
// TODO: Replace with linsa-specific key from https://jazz.tools
const JAZZ_API_KEY = "jazz_cloud_demo"

interface JazzProviderProps {
  children: React.ReactNode
}

/**
 * Jazz provider for stream viewer presence tracking
 * Uses anonymous auth - viewers don't need to sign in
 */
export function JazzProvider({ children }: JazzProviderProps) {
  return (
    <JazzReactProvider
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`,
        when: "always",
      }}
      AccountSchema={ViewerAccount}
    >
      {children}
    </JazzReactProvider>
  )
}
