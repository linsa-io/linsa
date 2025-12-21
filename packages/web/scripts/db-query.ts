/**
 * Production Database Query Tool
 * Allows CRUD operations on the production database
 *
 * Usage:
 *   DATABASE_URL="..." pnpm tsx scripts/db-query.ts
 *
 * Commands (interactive):
 *   tables     - List all tables
 *   users      - List all users
 *   threads    - List chat threads
 *   sql <query> - Run raw SQL
 *   insert-user <email> <name> - Create a user
 *   delete-user <id> - Delete a user
 *   help       - Show commands
 *   exit       - Exit
 */

import "dotenv/config"
import postgres from "postgres"
import * as readline from "readline"

const CONNECTION_STRING = process.env.DATABASE_URL

if (!CONNECTION_STRING) {
  console.error("❌ DATABASE_URL is required")
  process.exit(1)
}

const sql = postgres(CONNECTION_STRING, {
  ssl: "require",
  max: 1,
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

async function listTables() {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `
  console.log("\n📋 Tables:")
  if (tables.length === 0) {
    console.log("   (no tables found)")
  } else {
    for (const t of tables) {
      const count = await sql`
        SELECT COUNT(*) as count FROM ${sql(t.table_name)}
      `
      console.log(`   - ${t.table_name} (${count[0].count} rows)`)
    }
  }
  console.log()
}

async function listUsers() {
  try {
    const users = await sql`SELECT id, name, email, "createdAt" FROM users ORDER BY "createdAt" DESC LIMIT 20`
    console.log("\n👥 Users:")
    if (users.length === 0) {
      console.log("   (no users)")
    } else {
      for (const u of users) {
        console.log(`   - ${u.id}: ${u.name} <${u.email}> (${u.createdAt})`)
      }
    }
    console.log()
  } catch (e) {
    console.log("   ❌ users table not found or error:", (e as Error).message)
  }
}

async function listThreads() {
  try {
    const threads = await sql`
      SELECT id, title, user_id, created_at
      FROM chat_threads
      ORDER BY created_at DESC
      LIMIT 20
    `
    console.log("\n💬 Chat Threads:")
    if (threads.length === 0) {
      console.log("   (no threads)")
    } else {
      for (const t of threads) {
        console.log(`   - #${t.id}: "${t.title}" (user: ${t.user_id})`)
      }
    }
    console.log()
  } catch (e) {
    console.log("   ❌ chat_threads table not found or error:", (e as Error).message)
  }
}

async function runSQL(query: string) {
  try {
    const result = await sql.unsafe(query)
    console.log("\n✅ Result:")
    console.log(result)
    console.log()
  } catch (e) {
    console.log("❌ Error:", (e as Error).message)
  }
}

async function insertUser(email: string, name: string) {
  try {
    const id = `user_${Date.now()}`
    await sql`
      INSERT INTO users (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES (${id}, ${name}, ${email}, false, NOW(), NOW())
    `
    console.log(`✅ Created user: ${id}`)
  } catch (e) {
    console.log("❌ Error:", (e as Error).message)
  }
}

async function deleteUser(id: string) {
  try {
    const result = await sql`DELETE FROM users WHERE id = ${id}`
    console.log(`✅ Deleted ${result.count} user(s)`)
  } catch (e) {
    console.log("❌ Error:", (e as Error).message)
  }
}

function showHelp() {
  console.log(`
📖 Commands:
   tables              - List all tables with row counts
   users               - List users (max 20)
   threads             - List chat threads (max 20)
   sql <query>         - Run raw SQL query
   insert-user <email> <name> - Create a new user
   delete-user <id>    - Delete a user by ID
   drop-all            - Drop all tables (dangerous!)
   help                - Show this help
   exit                - Exit the tool
`)
}

async function dropAll() {
  const confirm = await prompt("⚠️  This will DROP ALL TABLES. Type 'DROP' to confirm: ")
  if (confirm !== "DROP") {
    console.log("Aborted.")
    return
  }

  const tables = [
    "thread_context_items",
    "context_items",
    "canvas_images",
    "canvas",
    "chat_messages",
    "chat_threads",
    "verifications",
    "accounts",
    "sessions",
    "users",
  ]

  for (const table of tables) {
    try {
      await sql`DROP TABLE IF EXISTS ${sql(table)} CASCADE`
      console.log(`   ✓ Dropped ${table}`)
    } catch (e) {
      console.log(`   ✗ ${table}: ${(e as Error).message}`)
    }
  }
  console.log("\n✓ All tables dropped")
}

async function main() {
  console.log("🔌 Connected to production database")
  console.log('Type "help" for commands, "exit" to quit.\n')

  // Check initial connection
  try {
    const [result] = await sql`SELECT current_database() as db`
    console.log(`Database: ${result.db}\n`)
  } catch (e) {
    console.error("❌ Connection failed:", (e as Error).message)
    process.exit(1)
  }

  while (true) {
    const input = await prompt("db> ")
    const [cmd, ...args] = input.trim().split(/\s+/)

    switch (cmd.toLowerCase()) {
      case "tables":
        await listTables()
        break
      case "users":
        await listUsers()
        break
      case "threads":
        await listThreads()
        break
      case "sql":
        await runSQL(args.join(" "))
        break
      case "insert-user":
        if (args.length < 2) {
          console.log("Usage: insert-user <email> <name>")
        } else {
          await insertUser(args[0], args.slice(1).join(" "))
        }
        break
      case "delete-user":
        if (args.length < 1) {
          console.log("Usage: delete-user <id>")
        } else {
          await deleteUser(args[0])
        }
        break
      case "drop-all":
        await dropAll()
        break
      case "help":
        showHelp()
        break
      case "exit":
      case "quit":
      case "q":
        console.log("Bye!")
        await sql.end()
        rl.close()
        process.exit(0)
      case "":
        break
      default:
        console.log(`Unknown command: ${cmd}. Type "help" for commands.`)
    }
  }
}

main().catch(console.error)
