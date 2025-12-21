/**
 * Test PlanetScale Postgres connection
 *
 * Run: pnpm tsx scripts/db-connect.ts
 */

import "dotenv/config"
import postgres from "postgres"

const CONNECTION_STRING = process.env.DATABASE_URL

if (!CONNECTION_STRING) {
  console.error("❌ DATABASE_URL is required in .env")
  process.exit(1)
}

const sql = postgres(CONNECTION_STRING, {
  ssl: "require",
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

async function testConnection() {
  console.log("🔌 Connecting to PlanetScale Postgres...")

  try {
    // Test basic connection
    const [result] = await sql`SELECT NOW() as time, current_database() as db`
    console.log("✅ Connected!")
    console.log(`   Database: ${result.db}`)
    console.log(`   Server time: ${result.time}`)

    // List all databases
    const databases = await sql`
      SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname
    `
    console.log(`\n📁 Databases:`)
    for (const d of databases) {
      console.log(`   - ${d.datname}`)
    }

    // List tables in current db
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    if (tables.length > 0) {
      console.log(`\n📋 Tables (${tables.length}):`)
      for (const t of tables) {
        console.log(`   - ${t.table_name}`)
      }
    } else {
      console.log("\n📋 No tables found in public schema")
    }

    // Show version
    const [version] = await sql`SELECT version()`
    console.log(`\n🐘 ${version.version}`)
  } catch (err) {
    console.error("❌ Connection failed:", err)
  } finally {
    await sql.end()
  }
}

testConnection()
