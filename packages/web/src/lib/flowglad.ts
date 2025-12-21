import { FlowgladServer } from "@flowglad/server"
import { getAuth } from "./auth"

type FlowgladEnv = {
  FLOWGLAD_SECRET_KEY?: string
}

const getEnv = (): FlowgladEnv => {
  let FLOWGLAD_SECRET_KEY: string | undefined

  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: FlowgladEnv } } | null
    }
    const ctx = getServerContext()
    FLOWGLAD_SECRET_KEY = ctx?.cloudflare?.env?.FLOWGLAD_SECRET_KEY
  } catch {
    // Not in server context
  }

  FLOWGLAD_SECRET_KEY = FLOWGLAD_SECRET_KEY ?? process.env.FLOWGLAD_SECRET_KEY

  return { FLOWGLAD_SECRET_KEY }
}

export const getFlowgladServer = (request?: Request) => {
  const env = getEnv()

  if (!env.FLOWGLAD_SECRET_KEY) {
    return null
  }

  return new FlowgladServer({
    apiKey: env.FLOWGLAD_SECRET_KEY,
    getRequestingCustomer: async () => {
      if (!request) {
        throw new Error("Request required to get customer")
      }

      const auth = getAuth()
      const session = await auth.api.getSession({ headers: request.headers })

      if (!session?.user) {
        throw new Error("Unauthenticated")
      }

      return {
        externalId: session.user.id,
        email: session.user.email,
        name: session.user.name ?? undefined,
      }
    },
  })
}

/**
 * Create a FlowgladServer instance for a specific user ID.
 * Use this when you already have the user ID and don't need request-based auth.
 */
export const flowglad = (userId: string) => {
  const env = getEnv()

  if (!env.FLOWGLAD_SECRET_KEY) {
    return null
  }

  return new FlowgladServer({
    apiKey: env.FLOWGLAD_SECRET_KEY,
    getRequestingCustomer: async () => ({
      externalId: userId,
    }),
  })
}
