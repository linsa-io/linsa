import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "../../web/src/db/schema"

export type Hyperdrive = {
  connectionString: string
}

export type WorkerEnv = {
  DATABASE_URL?: string
  HYPERDRIVE?: Hyperdrive
}

const getConnectionString = (env?: WorkerEnv): string => {
  if (env?.DATABASE_URL) {
    return env.DATABASE_URL
  }

  if (env?.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  throw new Error("No database connection available. Set DATABASE_URL or HYPERDRIVE.")
}

export const getDb = (env?: WorkerEnv) => {
  const connectionString = getConnectionString(env)
  const sql = postgres(connectionString, { prepare: false })
  return drizzle(sql, { schema, casing: "snake_case" })
}
