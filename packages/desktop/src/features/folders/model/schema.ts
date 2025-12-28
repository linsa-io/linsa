import { co, z, setDefaultSchemaPermissions } from "jazz-tools"

setDefaultSchemaPermissions({
  onInlineCreate: "sameAsContainer",
})

// A single code folder entry
export const CodeFolder = co.map({
  path: z.string(),
  addedAt: z.number(),
})
export type CodeFolder = co.loaded<typeof CodeFolder>

// List of code folders
export const CodeFoldersList = co.list(CodeFolder)
export type CodeFoldersList = co.loaded<typeof CodeFoldersList>

// App root data
export const AppRoot = co.map({
  folders: CodeFoldersList,
})
export type AppRoot = co.loaded<typeof AppRoot>

// Account profile (minimal)
export const AppProfile = co.profile({
  name: z.string().optional(),
})

// Main account schema with migration
export const AppAccount = co
  .account({
    root: AppRoot,
    profile: AppProfile,
  })
  .withMigration(async (account) => {
    // Initialize root if missing
    if (!account.$jazz.has("root")) {
      account.$jazz.set(
        "root",
        AppRoot.create({
          folders: CodeFoldersList.create([]),
        })
      )
    } else {
      // Ensure folders list exists
      const { root } = await account.$jazz.ensureLoaded({
        resolve: { root: true },
      })
      if (!root.$jazz.has("folders")) {
        root.$jazz.set("folders", CodeFoldersList.create([]))
      }
    }

    // Initialize profile if missing
    if (!account.$jazz.has("profile")) {
      account.$jazz.set(
        "profile",
        AppProfile.create({
          name: "Desktop User",
        })
      )
    }
  })

export type AppAccount = co.loaded<typeof AppAccount>
