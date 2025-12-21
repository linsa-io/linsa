import { co, z } from "jazz-tools"

/**
 * Presence entry - pushed to a feed when a viewer joins/updates
 */
export const Presence = z.object({
  /** Last activity timestamp */
  lastActive: z.number(),
})
export type Presence = z.infer<typeof Presence>

/**
 * A feed of presence entries - each session pushes their own presence
 * Jazz automatically tracks sessions, so we can count unique viewers
 */
export const PresenceFeed = co.feed(Presence)

/**
 * Container for a stream's presence feed - enables upsertUnique
 */
export const StreamPresenceContainer = co.map({
  presenceFeed: PresenceFeed,
})

/**
 * Account profile - minimal, just for Jazz to work
 */
export const ViewerProfile = co
  .profile({
    name: z.string(),
  })
  .withPermissions({
    onCreate: (newGroup) => newGroup.makePublic(),
  })

/**
 * Viewer account root - stores any viewer-specific data
 */
export const ViewerRoot = co.map({
  /** Placeholder field */
  version: z.number(),
})

/**
 * Viewer account - anonymous viewers watching streams
 */
export const ViewerAccount = co
  .account({
    profile: ViewerProfile,
    root: ViewerRoot,
  })
  .withMigration((account) => {
    if (!account.$jazz.has("profile")) {
      account.$jazz.set("profile", {
        name: "Anonymous",
      })
    }
    if (!account.$jazz.has("root")) {
      account.$jazz.set("root", {
        version: 1,
      })
    }
  })
