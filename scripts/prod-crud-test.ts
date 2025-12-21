import pg from "pg"

// PlanetScale credentials - use DATABASE_URL env var or fallback to hardcoded values
// Format: postgresql://username.branch:password@host/database?sslmode=require
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is required")
  console.error("Example: DATABASE_URL='postgresql://user.branch:pass@host/db?sslmode=require' pnpm exec tsx scripts/prod-crud-test.ts")
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
})

interface UserQueryResult {
  user_id: string | null
  email: string | null
  query_count: number
  messages: {
    id: number
    content: string
    created_at: Date
  }[]
}

// Get all user queries (messages with role='user') made today
async function getTodaysUserQueries(): Promise<UserQueryResult[]> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const result = await pool.query(
    `
    SELECT
      ct.user_id,
      u.email,
      cm.id as message_id,
      cm.content,
      cm.created_at
    FROM chat_messages cm
    JOIN chat_threads ct ON cm.thread_id = ct.id
    LEFT JOIN users u ON ct.user_id = u.id
    WHERE cm.role = 'user'
      AND cm.created_at >= $1
    ORDER BY cm.created_at DESC
    `,
    [todayStart]
  )

  // Group by user
  const userMap = new Map<string, UserQueryResult>()

  for (const row of result.rows) {
    const key = row.user_id ?? "guest"
    if (!userMap.has(key)) {
      userMap.set(key, {
        user_id: row.user_id,
        email: row.email,
        query_count: 0,
        messages: [],
      })
    }
    const user = userMap.get(key)!
    user.query_count++
    user.messages.push({
      id: row.message_id,
      content: row.content,
      created_at: row.created_at,
    })
  }

  return Array.from(userMap.values())
}

// Get total query count for today
async function getTodaysQueryCount(): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const result = await pool.query(
    `
    SELECT COUNT(*) as count
    FROM chat_messages cm
    WHERE cm.role = 'user'
      AND cm.created_at >= $1
    `,
    [todayStart]
  )

  return parseInt(result.rows[0].count, 10)
}

async function main() {
  console.log("Connecting to PlanetScale production database...\n")

  try {
    // Test connection
    const result = await pool.query("SELECT NOW() as now")
    console.log(`Connected! Server time: ${result.rows[0].now}\n`)

    // Get today's query count
    const count = await getTodaysQueryCount()
    console.log(`Total user queries today: ${count}\n`)

    // Get detailed breakdown by user
    const userQueries = await getTodaysUserQueries()

    if (userQueries.length === 0) {
      console.log("No user queries found today.")
    } else {
      console.log(`Queries by ${userQueries.length} users today:\n`)

      for (const user of userQueries) {
        const userLabel = user.email ?? (user.user_id ? `User ${user.user_id}` : "Guest")
        console.log(`--- ${userLabel} (${user.query_count} queries) ---`)

        for (const msg of user.messages.slice(0, 5)) {
          const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content
          console.log(`  [${msg.created_at.toLocaleTimeString()}] ${preview}`)
        }

        if (user.messages.length > 5) {
          console.log(`  ... and ${user.messages.length - 5} more`)
        }
        console.log()
      }
    }
  } catch (error) {
    console.error("Database error:", error)
  } finally {
    await pool.end()
  }
}

main()
