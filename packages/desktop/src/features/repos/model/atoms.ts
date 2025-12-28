import { atom, action } from "@reatom/core"

export interface GitRepo {
  name: string
  path: string
  lastModified: number
}

// Local state for scanned repos (not synced via Jazz)
export const reposAtom = atom<GitRepo[]>([], "repos")

// Scanning state
export const isScanningAtom = atom(false, "isScanning")

// Scan folders for git repos
export const scanReposAction = action(async (ctx, folders: string[]) => {
  if (folders.length === 0) {
    reposAtom(ctx, [])
    return
  }

  isScanningAtom(ctx, true)

  try {
    const repos = await window.electronAPI.scanRepos(folders)
    reposAtom(ctx, repos)
  } finally {
    isScanningAtom(ctx, false)
  }
}, "scanRepos")
