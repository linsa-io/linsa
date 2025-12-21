import "dotenv/config"
import crypto from "node:crypto"
import { sql, eq } from "drizzle-orm"
import { getDb, getAuthDb } from "../src/db/connection"
import {
  accounts,
  chat_messages,
  chat_threads,
  sessions,
  users,
  verifications,
} from "../src/db/schema"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required in packages/web/.env")
}

const appDb = getDb(databaseUrl)
const authDb = getAuthDb(databaseUrl)

async function ensureTables() {
  await authDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      "image" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await authDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" text PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "users"("id") ON DELETE cascade
    );
  `)

  await authDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      "scope" text,
      "password" text,
      "createdAt" timestamptz NOT NULL,
      "updatedAt" timestamptz NOT NULL
    );
  `)

  await authDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "verifications" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz DEFAULT now(),
      "updatedAt" timestamptz DEFAULT now()
    );
  `)

  // Backfill camelCase columns when an older snake_case seed created the tables.
  // Add missing legacy snake_case columns first so COALESCE references are safe.
  await authDb.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified" boolean,
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz
  `)
  await authDb.execute(sql`
    ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "ip_address" text,
      ADD COLUMN IF NOT EXISTS "user_agent" text,
      ADD COLUMN IF NOT EXISTS "user_id" text
  `)
  await authDb.execute(sql`
    ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "account_id" text,
      ADD COLUMN IF NOT EXISTS "provider_id" text,
      ADD COLUMN IF NOT EXISTS "user_id" text,
      ADD COLUMN IF NOT EXISTS "access_token" text,
      ADD COLUMN IF NOT EXISTS "refresh_token" text,
      ADD COLUMN IF NOT EXISTS "id_token" text,
      ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz
  `)
  await authDb.execute(sql`
    ALTER TABLE "verifications"
      ADD COLUMN IF NOT EXISTS "expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz
  `)

  await authDb.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz DEFAULT now()
  `)
  await authDb.execute(
    sql`UPDATE "users" SET "emailVerified" = COALESCE("emailVerified", "email_verified")`,
  )
  await authDb.execute(
    sql`UPDATE "users" SET "createdAt" = COALESCE("createdAt", "created_at")`,
  )
  await authDb.execute(
    sql`UPDATE "users" SET "updatedAt" = COALESCE("updatedAt", "updated_at")`,
  )

  await authDb.execute(sql`
    ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "token" text,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "ipAddress" text,
      ADD COLUMN IF NOT EXISTS "userAgent" text,
      ADD COLUMN IF NOT EXISTS "userId" text
  `)
  await authDb.execute(
    sql`UPDATE "sessions" SET "expiresAt" = COALESCE("expiresAt", "expires_at")`,
  )
  await authDb.execute(
    sql`UPDATE "sessions" SET "createdAt" = COALESCE("createdAt", "created_at")`,
  )
  await authDb.execute(
    sql`UPDATE "sessions" SET "updatedAt" = COALESCE("updatedAt", "updated_at")`,
  )
  await authDb.execute(
    sql`UPDATE "sessions" SET "ipAddress" = COALESCE("ipAddress", "ip_address")`,
  )
  await authDb.execute(
    sql`UPDATE "sessions" SET "userAgent" = COALESCE("userAgent", "user_agent")`,
  )
  await authDb.execute(
    sql`UPDATE "sessions" SET "userId" = COALESCE("userId", "user_id")`,
  )

  await authDb.execute(sql`
    ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "accountId" text,
      ADD COLUMN IF NOT EXISTS "providerId" text,
      ADD COLUMN IF NOT EXISTS "userId" text,
      ADD COLUMN IF NOT EXISTS "accessToken" text,
      ADD COLUMN IF NOT EXISTS "refreshToken" text,
      ADD COLUMN IF NOT EXISTS "idToken" text,
      ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz
  `)
  await authDb.execute(
    sql`UPDATE "accounts" SET "accountId" = COALESCE("accountId", "account_id")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "providerId" = COALESCE("providerId", "provider_id")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "userId" = COALESCE("userId", "user_id")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "accessToken" = COALESCE("accessToken", "access_token")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "refreshToken" = COALESCE("refreshToken", "refresh_token")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "idToken" = COALESCE("idToken", "id_token")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "accessTokenExpiresAt" = COALESCE("accessTokenExpiresAt", "access_token_expires_at")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "refreshTokenExpiresAt" = COALESCE("refreshTokenExpiresAt", "refresh_token_expires_at")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "createdAt" = COALESCE("createdAt", "created_at")`,
  )
  await authDb.execute(
    sql`UPDATE "accounts" SET "updatedAt" = COALESCE("updatedAt", "updated_at")`,
  )

  await authDb.execute(sql`
    ALTER TABLE "verifications"
      ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz
  `)
  await authDb.execute(
    sql`UPDATE "verifications" SET "expiresAt" = COALESCE("expiresAt", "expires_at")`,
  )
  await authDb.execute(
    sql`UPDATE "verifications" SET "createdAt" = COALESCE("createdAt", "created_at")`,
  )
  await authDb.execute(
    sql`UPDATE "verifications" SET "updatedAt" = COALESCE("updatedAt", "updated_at")`,
  )

  await appDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "chat_threads" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "title" text NOT NULL,
      "user_id" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await appDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "chat_messages" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "thread_id" integer NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
      "role" varchar(32) NOT NULL,
      "content" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await appDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "context_items" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "type" varchar(32) NOT NULL,
      "url" text,
      "name" text NOT NULL,
      "content" text,
      "refreshing" boolean NOT NULL DEFAULT false,
      "parent_id" integer,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await appDb.execute(sql`
    CREATE TABLE IF NOT EXISTS "thread_context_items" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "thread_id" integer NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
      "context_item_id" integer NOT NULL REFERENCES "context_items"("id") ON DELETE cascade,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
  `)
}

async function seed() {
  await ensureTables()

  const demoUserId = "demo-user"
  const demoEmail = "demo@ai.chat"

  await authDb
    .insert(users)
    .values({
      id: demoUserId,
      name: "Demo User",
      email: demoEmail,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: users.id })

  // Clear any orphaned auth rows for the demo user to keep data tidy
  await authDb.delete(sessions).where(eq(sessions.userId, demoUserId))
  await authDb.delete(accounts).where(eq(accounts.userId, demoUserId))
  await authDb.delete(verifications).where(eq(verifications.identifier, demoEmail))

  // Find or create a chat thread for the demo user
  const [existingThread] = await appDb
    .select()
    .from(chat_threads)
    .where(eq(chat_threads.user_id, demoUserId))
    .limit(1)

  const [thread] =
    existingThread && existingThread.id
      ? [existingThread]
      : await appDb
          .insert(chat_threads)
          .values({
            title: "Getting started with AI chat",
            user_id: demoUserId,
          })
          .returning()

  const threadId = thread.id

  await appDb
    .delete(chat_messages)
    .where(eq(chat_messages.thread_id, threadId))

  const starterMessages = [
    {
      role: "user",
      content: "How do I get reliable AI chat responses from this app?",
    },
    {
      role: "assistant",
      content:
        "Each thread keeps your message history. You can seed demos like this one, or stream responses from your AI provider. Try adding more messages to this thread.",
    },
    {
      role: "user",
      content: "Can I hook this up to my own model API?",
    },
    {
      role: "assistant",
      content:
        "Yes. Point your server-side handler at your model endpoint and persist messages into the database. Electric can sync them live to the client.",
    },
  ]

  await appDb.insert(chat_messages).values(
    starterMessages.map((msg) => ({
      thread_id: threadId,
      role: msg.role,
      content: msg.content,
      created_at: new Date(),
    })),
  )
}

seed()
  .then(() => {
    console.log("Seed complete: demo user and chat thread ready.")
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
