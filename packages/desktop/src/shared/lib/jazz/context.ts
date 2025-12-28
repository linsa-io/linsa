import { atom, computed, withSuspenseInit, wrap } from "@reatom/core"
import { JazzContextManager, type AccountSchema, BrowserContext } from "jazz-tools"

export async function createElectronJazzApp<S extends AccountSchema>(opts: {
  AccountSchema: S
  sync?: { peer: string }
}) {
  const contextManager = new JazzContextManager<S>()

  await contextManager.createContext({
    ...opts,
    guestMode: false,
    storage: "indexedDB",
    defaultProfileName: "Linsa Desktop",
    authSecretStorageKey: "linsa-desktop-auth",
  })

  return contextManager
}

// Jazz context as a Reatom atom
const jazzApp = atom(async () => {
  const { AppAccount } = await wrap(import("@/features/folders/model/schema"))

  return wrap(
    createElectronJazzApp({
      AccountSchema: AppAccount,
      // No sync for now - local only
      // sync: { peer: "wss://cloud.jazz.tools/?key=..." },
    })
  )
}, "jazzApp").extend(withSuspenseInit())

export type JazzContextAtom = typeof jazzContext
export const jazzContext = computed(() => {
  const contextManager = jazzApp()

  const requireCurrentContext = () => {
    const currentValue = contextManager.getCurrentValue()
    if (!currentValue) throw new Error("Jazz context not ready")
    if (!("me" in currentValue)) throw new Error("Guest mode not supported")
    return currentValue as BrowserContext<typeof import("@/features/folders/model/schema").AppAccount>
  }

  return {
    current: requireCurrentContext,
    manager: contextManager,
  }
}, "jazzContext")
