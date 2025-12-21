import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

type Hyperdrive = {
  connectionString: string
}

type CloudflareEnv = {
  DATABASE_URL?: string
  HYPERDRIVE?: Hyperdrive
}

// Note: NO caching - Cloudflare Workers don't allow sharing I/O objects across requests

// Get the database connection string, preferring DATABASE_URL over Hyperdrive
const getConnectionString = (env?: CloudflareEnv): string => {
  // Prefer DATABASE_URL if set (direct connection, bypasses Hyperdrive)
  if (env?.DATABASE_URL) {
    return env.DATABASE_URL
  }

  // Fall back to Hyperdrive if available
  if (env?.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString
  }

  // Fall back to process.env (local dev)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  throw new Error("No database connection available. Set DATABASE_URL or configure Hyperdrive.")
}

// Helper to get Cloudflare env from server context
const getCloudflareEnv = (): CloudflareEnv | undefined => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: CloudflareEnv } } | null
    }
    return getServerContext()?.cloudflare?.env
  } catch {
    return undefined
  }
}

// Convenience function to get db using server context
export const db = () => getDb(getConnectionString(getCloudflareEnv()))
export const authDb = () => getAuthDb(getConnectionString(getCloudflareEnv()))

// Main db with snake_case casing for app tables (chat_threads, chat_messages)
export const getDb = (databaseUrlOrHyperdrive: string | Hyperdrive) => {
  const connectionString =
    typeof databaseUrlOrHyperdrive === "string"
      ? databaseUrlOrHyperdrive
      : databaseUrlOrHyperdrive.connectionString

  // Create fresh connection per request for Cloudflare Workers compatibility
  const sql = postgres(connectionString, { prepare: false })
  return drizzle(sql, { schema, casing: "snake_case" })
}

// Auth db WITHOUT casing transform for better-auth tables (users, sessions, etc.)
// better-auth uses camelCase columns and manages its own naming
export const getAuthDb = (databaseUrlOrHyperdrive: string | Hyperdrive) => {
  const connectionString =
    typeof databaseUrlOrHyperdrive === "string"
      ? databaseUrlOrHyperdrive
      : databaseUrlOrHyperdrive.connectionString

  // Create fresh connection per request for Cloudflare Workers compatibility
  const sql = postgres(connectionString, { prepare: false })
  return drizzle(sql, { schema })
}
