import { eq } from "drizzle-orm"
import { getAuth } from "@/lib/auth"
import { getAuthDb } from "@/db/connection"
import { users } from "@/db/schema"

const COOKIE_NAME = "canvas_guest_id"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const parseCookies = (header: string | null) => {
  if (!header) return {}
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=")
    if (!key) return acc
    acc[key] = rest.join("=")
    return acc
  }, {})
}

const buildCookie = (id: string) =>
  `${COOKIE_NAME}=${id}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`

const resolveDatabaseUrl = () => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const url = ctx?.cloudflare?.env?.DATABASE_URL
    if (url) {
      return url
    }
  } catch {
    // ignore
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  throw new Error("DATABASE_URL is not configured")
}

const getAuthDatabase = () => {
  const url = resolveDatabaseUrl()
  return getAuthDb(url)
}

async function ensureGuestUser(existingId?: string) {
  const db = getAuthDatabase()

  if (existingId) {
    const existing = await db.query.users.findFirst({
      where(fields, { eq }) {
        return eq(fields.id, existingId)
      },
    })

    if (existing) {
      return { userId: existingId, setCookie: undefined }
    }
  }

  const newId = crypto.randomUUID()
  const email = `canvas-guest-${newId}@example.local`

  await db.insert(users).values({
    id: newId,
    name: "Canvas Guest",
    email,
  })

  return { userId: newId, setCookie: buildCookie(newId) }
}

export async function resolveCanvasUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers })

  if (session?.user?.id) {
    return { userId: session.user.id, setCookie: undefined }
  }

  const cookies = parseCookies(request.headers.get("cookie"))
  const guestId = cookies[COOKIE_NAME]
  return ensureGuestUser(guestId)
}
