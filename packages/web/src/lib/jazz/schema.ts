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
 * Stream comment with optional image attachment using FileStream
 */
export const StreamComment = co.map({
  /** Comment text content */
  content: z.string(),
  /** User display name */
  userName: z.string(),
  /** User ID (from auth) */
  userId: z.string().nullable(),
  /** Optional image attachment */
  image: co.optional(co.fileStream()),
  /** Timestamp */
  createdAt: z.number(),
})
export type StreamComment = co.loaded<typeof StreamComment>

/**
 * List of stream comments - real-time chat
 */
export const StreamCommentList = co.list(StreamComment)

/**
 * Container for a stream's comments - enables upsertUnique per stream
 */
export const StreamCommentsContainer = co.map({
  comments: StreamCommentList,
})

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
 * A Glide canvas item (PDF screenshot, web capture, etc.)
 */
export const GlideCanvasItem = z.object({
  id: z.string(),
  type: z.enum(["pdf", "web", "image"]),
  title: z.string(),
  sourceUrl: z.string().nullable(),
  imageData: z.string().nullable(), // Base64 encoded image
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
  createdAt: z.number(),
  metadata: z.string().nullable(), // JSON string for metadata
})
export type GlideCanvasItem = z.infer<typeof GlideCanvasItem>

/**
 * List of Glide canvas items
 */
export const GlideCanvasList = co.list(GlideCanvasItem)

/**
 * Live stream recording - stores video chunks as they're streamed
 */
export const StreamRecording = co.map({
  title: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  durationMs: z.number(),
  streamKey: z.string(),
  isLive: z.boolean(),
  /** Video file being recorded in real-time */
  videoFile: co.fileStream(),
  /** Preview thumbnail */
  thumbnailData: z.string().nullable(),
  /** Metadata about the recording */
  metadata: z.object({
    width: z.number().nullable(),
    height: z.number().nullable(),
    fps: z.number().nullable(),
    bitrate: z.number().nullable(),
  }).nullable(),
})
export type StreamRecording = z.infer<typeof StreamRecording>

/**
 * List of stream recordings
 */
export const StreamRecordingList = co.list(StreamRecording)

/**
 * Cloudflare Stream configuration
 */
export const CloudflareStreamConfig = co.map({
  /** Cloudflare Live Input UID (permanent, doesn't change between connections) */
  liveInputUid: z.string(),
  /** Cloudflare customer code (e.g., xctsztqzu046isdc) */
  customerCode: z.string(),
  /** Stream name/title */
  name: z.string(),
  /** Last updated timestamp */
  updatedAt: z.number(),
})
export type CloudflareStreamConfig = co.loaded<typeof CloudflareStreamConfig>

/**
 * Stream filter configuration - dynamically controls what apps are captured
 */
export const StreamFilterConfig = co.map({
  /** Apps allowed to appear in stream (empty = all allowed) */
  allowedApps: z.array(z.string()),
  /** Apps blocked from stream (takes precedence over allowed) */
  blockedApps: z.array(z.string()),
  /** Apps to capture audio from */
  audioApps: z.array(z.string()),
  /** Last updated timestamp */
  updatedAt: z.number(),
  /** Version number for change tracking */
  version: z.number(),
})
export type StreamFilterConfig = co.loaded<typeof StreamFilterConfig>

/**
 * Viewer account root - stores any viewer-specific data
 */
export const ViewerRoot = co.map({
  /** Placeholder field */
  version: z.number(),
  /** User's saved URLs */
  savedUrls: SavedUrlList,
  /** Glide browser canvas items */
  glideCanvas: GlideCanvasList,
  /** Live stream recordings */
  streamRecordings: StreamRecordingList,
  /** Cloudflare Stream configuration */
  cloudflareConfig: co.optional(CloudflareStreamConfig),
  /** Stream filter configuration (allowed/blocked apps) */
  streamFilter: co.optional(StreamFilterConfig),
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
        glideCanvas: GlideCanvasList.create([]),
        streamRecordings: StreamRecordingList.create([]),
      })
    }
  })
