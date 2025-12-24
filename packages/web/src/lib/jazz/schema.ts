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
 * Paid comment entry - a message attached to a verified payment
 */
export const PaidComment = z.object({
  message: z.string(),
  sender: z.string().nullable(),
  usdAmount: z.number(),
  solAmount: z.number(),
  signature: z.string(),
  createdAt: z.number(),
})
export type PaidComment = z.infer<typeof PaidComment>

/**
 * Feed of paid comment entries
 */
export const PaidCommentFeed = co.feed(PaidComment)

/**
 * Container for a stream's presence feed - enables upsertUnique
 */
export const StreamPresenceContainer = co.map({
  presenceFeed: PresenceFeed,
})

/**
 * Container for a stream's paid comment feed - enables upsertUnique
 */
export const StreamPaidCommentsContainer = co.map({
  commentFeed: PaidCommentFeed,
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
 * A saved URL entry
 */
export const SavedUrl = z.object({
  url: z.string(),
  title: z.string().nullable(),
  createdAt: z.number(),
})
export type SavedUrl = z.infer<typeof SavedUrl>

/**
 * List of saved URLs
 */
export const SavedUrlList = co.list(SavedUrl)

/**
 * Viewer account root - stores any viewer-specific data
 */
export const ViewerRoot = co.map({
  /** Placeholder field */
  version: z.number(),
  /** User's saved URLs */
  savedUrls: SavedUrlList,
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
        savedUrls: SavedUrlList.create([]),
      })
    }
  })
