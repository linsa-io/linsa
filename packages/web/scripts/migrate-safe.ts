/**
 * Safe production migration script
 * Usage: DATABASE_URL="..." pnpm tsx scripts/migrate-safe.ts [option]
 * Options: check | auth | drizzle | both
 */
import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required")
  process.exit(1)
}

const sql = postgres(DATABASE_URL)

async function checkConnection() {
  try {
    await sql`SELECT 1`
    console.log("✓ Connected to database")
    return true
  } catch (e) {
    console.error("✗ Connection failed:", (e as Error).message)
    return false
  }
}

async function listTables() {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `
  if (tables.length === 0) {
    console.log("   (no tables)")
  } else {
    tables.forEach((t) => console.log("   -", t.table_name))
  }
}

async function checkAuthTables() {
  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'verifications'
    ORDER BY ordinal_position
  `
  if (cols.length === 0) {
    console.log("   verifications: NOT EXISTS (will be created)")
    return false
  }
  const colNames = cols.map((c) => c.column_name)
  if (colNames.includes("expiresAt")) {
    console.log("   verifications: ✓ Correct (camelCase)")
    return true
  } else {
    console.log("   verifications: ⚠ Wrong columns:", colNames.join(", "))
    return false
  }
}

async function createAuthTables() {
  console.log("Dropping existing auth tables...")
  await sql`DROP TABLE IF EXISTS verifications CASCADE`
  await sql`DROP TABLE IF EXISTS accounts CASCADE`
  await sql`DROP TABLE IF EXISTS sessions CASCADE`
  await sql`DROP TABLE IF EXISTS users CASCADE`

  console.log("Creating auth tables with camelCase columns...")
  await sql.unsafe(`
    CREATE TABLE users (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      image text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE sessions (
      id text PRIMARY KEY,
      "expiresAt" timestamp NOT NULL,
      token text NOT NULL UNIQUE,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE accounts (
      id text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamp,
      "refreshTokenExpiresAt" timestamp,
      scope text,
      password text,
      "createdAt" timestamp NOT NULL,
      "updatedAt" timestamp NOT NULL
    );
    CREATE TABLE verifications (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamp NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );
  `)
  console.log("✓ Auth tables created")
}

async function main() {
  const option = process.argv[2] || "check"

  if (!(await checkConnection())) {
    await sql.end()
    process.exit(1)
  }

  if (option === "check") {
    console.log("\nCurrent tables:")
    await listTables()
    console.log("\nAuth tables status:")
    await checkAuthTables()
  } else if (option === "auth") {
    await createAuthTables()
  } else if (option === "drizzle") {
    console.log("Run: DATABASE_URL=\"...\" pnpm drizzle-kit push --force")
  } else if (option === "both") {
    await createAuthTables()
    console.log("\nNow run: DATABASE_URL=\"...\" pnpm drizzle-kit push --force")
  } else {
    console.log("Unknown option:", option)
    console.log("Options: check | auth | drizzle | both")
  }

  await sql.end()
}

main().catch((e) => {
  console.error(e)
  sql.end()
  process.exit(1)
})
