import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

const { createSelectSchema } = createSchemaFactory({ zodInstance: z })

// Better-auth tables (using camelCase as better-auth expects)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").unique(), // unique username for stream URLs (linsa.io/username)
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
})

// App tables (using snake_case for Electric sync compatibility)
export const chat_threads = pgTable("chat_threads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  user_id: text("user_id"), // nullable for guest users
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const chat_messages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  thread_id: integer("thread_id")
    .notNull()
    .references(() => chat_threads.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const canvas = pgTable("canvas", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Canvas"),
  width: integer("width").notNull().default(1024),
  height: integer("height").notNull().default(1024),
  default_model: text("default_model")
    .notNull()
    .default("gemini-2.5-flash-image-preview"),
  default_style: text("default_style").notNull().default("default"),
  background_prompt: text("background_prompt"),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const canvas_images = pgTable(
  "canvas_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvas_id: uuid("canvas_id")
      .notNull()
      .references(() => canvas.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Untitled Image"),
    prompt: text("prompt").notNull().default(""),
    model_id: text("model_id")
      .notNull()
      .default("gemini-2.0-flash-exp-image-generation"),
    model_used: text("model_used"),
    style_id: text("style_id").notNull().default("default"),
    width: integer("width").notNull().default(512),
    height: integer("height").notNull().default(512),
    position: jsonb("position")
      .$type<{ x: number; y: number }>()
      .$defaultFn(() => ({ x: 0, y: 0 }))
      .notNull(),
    rotation: doublePrecision("rotation").notNull().default(0),
    content_base64: text("content_base64"),
    image_url: text("image_url"),
    metadata: jsonb("metadata"),
    branch_parent_id: uuid("branch_parent_id"),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    branchParentFk: foreignKey({
      columns: [table.branch_parent_id],
      foreignColumns: [table.id],
      name: "canvas_images_branch_parent_id_canvas_images_id_fk",
    }).onDelete("set null"),
  }),
)

// Context items for website/file content injection into chat
export const context_items = pgTable("context_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(), // 'url' or 'file'
  url: text("url"), // URL for web content
  name: text("name").notNull(), // Display name (domain/path or filename)
  content: text("content"), // Fetched markdown content
  refreshing: boolean("refreshing").notNull().default(false),
  parent_id: integer("parent_id"), // For hierarchical URL structure
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Junction table for active context items per thread
export const thread_context_items = pgTable("thread_context_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  thread_id: integer("thread_id")
    .notNull()
    .references(() => chat_threads.id, { onDelete: "cascade" }),
  context_item_id: integer("context_item_id")
    .notNull()
    .references(() => context_items.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const blocks = pgTable("blocks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Browser sessions - for saving browser tabs (Safari, Chrome, etc.)
export const browser_sessions = pgTable("browser_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "2024-01-23-safari-tabs-1"
  browser: varchar("browser", { length: 32 }).notNull().default("safari"), // safari, chrome, firefox, arc, etc.
  tab_count: integer("tab_count").notNull().default(0),
  is_favorite: boolean("is_favorite").notNull().default(false),
  captured_at: timestamp("captured_at", { withTimezone: true })
    .defaultNow()
    .notNull(), // when the session was captured
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const browser_session_tabs = pgTable("browser_session_tabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  session_id: uuid("session_id")
    .notNull()
    .references(() => browser_sessions.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0), // order within session
  favicon_url: text("favicon_url"), // optional favicon
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// =============================================================================
// Streams (Twitch-like live streaming)
// =============================================================================

export const streams = pgTable("streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Live Stream"),
  description: text("description"),
  is_live: boolean("is_live").notNull().default(false),
  viewer_count: integer("viewer_count").notNull().default(0),
  stream_key: text("stream_key").notNull().unique(), // secret key for streaming
  // Stream endpoints (set by Linux server)
  hls_url: text("hls_url"), // HLS playback URL
  thumbnail_url: text("thumbnail_url"),
  started_at: timestamp("started_at", { withTimezone: true }),
  ended_at: timestamp("ended_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const selectStreamsSchema = createSelectSchema(streams)
export type Stream = z.infer<typeof selectStreamsSchema>

export const selectUsersSchema = createSelectSchema(users)
export const selectChatThreadSchema = createSelectSchema(chat_threads)
export const selectChatMessageSchema = createSelectSchema(chat_messages)
export const selectCanvasSchema = createSelectSchema(canvas)
export const selectCanvasImageSchema = createSelectSchema(canvas_images)
export const selectContextItemSchema = createSelectSchema(context_items)
export const selectThreadContextItemSchema =
  createSelectSchema(thread_context_items)
export const selectBrowserSessionSchema = createSelectSchema(browser_sessions)
export const selectBrowserSessionTabSchema =
  createSelectSchema(browser_session_tabs)
export type User = z.infer<typeof selectUsersSchema>
export type ChatThread = z.infer<typeof selectChatThreadSchema>
export type ChatMessage = z.infer<typeof selectChatMessageSchema>
export type CanvasRecord = z.infer<typeof selectCanvasSchema>
export type CanvasImage = z.infer<typeof selectCanvasImageSchema>
export type ContextItem = z.infer<typeof selectContextItemSchema>
export type ThreadContextItem = z.infer<typeof selectThreadContextItemSchema>
export type BrowserSession = z.infer<typeof selectBrowserSessionSchema>
export type BrowserSessionTab = z.infer<typeof selectBrowserSessionTabSchema>
