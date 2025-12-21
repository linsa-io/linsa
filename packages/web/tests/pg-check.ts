import postgres from "postgres"

const connectionString = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL

if (!connectionString) {
  console.error("Error: DATABASE_URL or PROD_DATABASE_URL must be set")
  process.exit(1)
}

async function main() {
  console.log("Connecting to PostgreSQL...")
  const sql = postgres(connectionString, { prepare: false })

  try {
    // Test connection
    const [{ now }] = await sql`SELECT NOW() as now`
    console.log("Connected! Server time:", now)

    // Create test table
    console.log("\n1. Creating test table...")
    await sql`
      CREATE TABLE IF NOT EXISTS pg_check_test (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    console.log("   Table created")

    // Insert
    console.log("\n2. Inserting row...")
    const [inserted] = await sql`
      INSERT INTO pg_check_test (name)
      VALUES (${"test-" + Date.now()})
      RETURNING *
    `
    console.log("   Inserted:", inserted)

    // Read
    console.log("\n3. Reading rows...")
    const rows = await sql`SELECT * FROM pg_check_test ORDER BY id DESC LIMIT 5`
    console.log("   Found", rows.length, "rows:")
    rows.forEach((r) => console.log("   -", r))

    // Update
    console.log("\n4. Updating row...")
    const [updated] = await sql`
      UPDATE pg_check_test
      SET name = ${"updated-" + Date.now()}
      WHERE id = ${inserted.id}
      RETURNING *
    `
    console.log("   Updated:", updated)

    // Delete
    console.log("\n5. Deleting row...")
    const [deleted] = await sql`
      DELETE FROM pg_check_test
      WHERE id = ${inserted.id}
      RETURNING *
    `
    console.log("   Deleted:", deleted)

    // Cleanup table
    console.log("\n6. Dropping test table...")
    await sql`DROP TABLE pg_check_test`
    console.log("   Table dropped")

    console.log("\nAll CRUD operations passed!")
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await sql.end()
    console.log("\nConnection closed.")
  }
}

main()
