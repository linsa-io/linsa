import { atom, computed } from "@reatom/core"
import { reatomJazz } from "@/shared/lib/reatom/jazz"
import { jazzContext } from "@/shared/lib/jazz/context"
import {
  AppAccount,
  AppRoot,
  CodeFolder,
  CodeFoldersList,
} from "./schema"

// Reatom factory for CodeFolder
export const reatomCodeFolder = reatomJazz({
  schema: CodeFolder,
  name: "codeFolder",
  create: ({ loaded }) => ({
    path: loaded.path,
    addedAt: loaded.addedAt,
  }),
})
export type CodeFolderModel = ReturnType<typeof reatomCodeFolder>

// Reatom factory for CodeFoldersList
export const reatomCodeFoldersList = reatomJazz({
  schema: CodeFoldersList,
  name: "codeFoldersList",
  create: ({ loaded }) => {
    const items = [...loaded.$jazz.refs].map((ref) => reatomCodeFolder(ref.id))
    return { items }
  },
})

// Reatom factory for AppRoot
export const reatomAppRoot = reatomJazz({
  schema: AppRoot,
  name: "appRoot",
  resolve: { folders: { $each: true } },
  create: ({ loaded }) => {
    const foldersId = loaded.$jazz.refs.folders?.id
    return {
      folders: foldersId ? reatomCodeFoldersList(foldersId) : undefined,
    }
  },
})

// Reatom factory for AppAccount
export const reatomAppAccount = reatomJazz({
  schema: AppAccount,
  name: "appAccount",
  resolve: { root: { folders: { $each: true } } },
  create: ({ loaded }) => {
    const rootId = loaded.$jazz.refs.root?.id
    return {
      root: rootId ? reatomAppRoot(rootId) : undefined,
    }
  },
})

// Current account atom - derived from Jazz context
export const currentAccount = computed(() => {
  const ctx = jazzContext()
  const accountId = ctx.current().me.$jazz.id
  return reatomAppAccount(accountId)()
}, "currentAccount")

// Convenience atom for folders list
export const codeFolders = computed(() => {
  const account = currentAccount()
  const root = account.root?.()
  const folders = root?.folders?.()
  return folders?.items ?? []
}, "codeFolders")

// Actions
export const addFolderAction = atom(null, (get, set, path: string) => {
  const ctx = jazzContext()
  const me = ctx.current().me as co.loaded<typeof AppAccount>

  if (!me.root?.folders) return

  // Check if already exists
  const existing = [...me.root.folders].find((f) => f?.path === path)
  if (existing) return

  // Create new folder entry
  const folder = CodeFolder.create({
    path,
    addedAt: Date.now(),
  })

  // Add to list
  me.root.folders.$jazz.push(folder)
}, "addFolderAction")

export const removeFolderAction = atom(null, (get, set, path: string) => {
  const ctx = jazzContext()
  const me = ctx.current().me as co.loaded<typeof AppAccount>

  if (!me.root?.folders) return

  // Find index
  const index = [...me.root.folders].findIndex((f) => f?.path === path)
  if (index === -1) return

  // Remove from list
  me.root.folders.$jazz.splice(index, 1)
}, "removeFolderAction")

// Import for co type
import { co } from "jazz-tools"
