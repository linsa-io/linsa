/**
 * Generate an API key for a user (for testing)
 *
 * Usage:
 *   pnpm tsx tests/generate-api-key.ts <user_id>
 *
 * Example:
 *   pnpm tsx tests/generate-api-key.ts nikiv
 */

import "dotenv/config"
import { getDb } from "../src/db/connection"
import { api_keys } from "../src/db/schema"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const userId = process.argv[2]

if (!userId) {
  console.error("Usage: pnpm tsx tests/generate-api-key.ts <user_id>")
  process.exit(1)
}

// Generate a random API key
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let key = "lk_"
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

// Hash function
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function main() {
  const db = getDb(databaseUrl!)

  const plainKey = generateApiKey()
  const keyHash = await hashApiKey(plainKey)

  await db.insert(api_keys).values({
    user_id: userId,
    key_hash: keyHash,
    name: "CLI Generated",
  })

  console.log("")
  console.log("API Key generated successfully!")
  console.log("")
  console.log("Key (save this, it won't be shown again):")
  console.log(`  ${plainKey}`)
  console.log("")
  console.log("Usage:")
  console.log(`  LINSA_API_KEY=${plainKey} pnpm tsx tests/bookmarks-save.ts`)
  console.log("")
}

main().catch(console.error)
