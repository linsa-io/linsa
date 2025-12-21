import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client"

type ElectricEnv = {
  ELECTRIC_URL?: string
  ELECTRIC_SOURCE_ID?: string
  ELECTRIC_SOURCE_SECRET?: string
}
const DEFAULT_ALLOW_HEADERS =
  "content-type,authorization,x-requested-with,x-electric-client-id"

// Get env from Cloudflare context or process.env
const getElectricEnv = (): ElectricEnv => {
  let ELECTRIC_URL: string | undefined
  let ELECTRIC_SOURCE_ID: string | undefined
  let ELECTRIC_SOURCE_SECRET: string | undefined

  // Try Cloudflare Workers context first (production)
  try {
    const { getServerContext } = require("@tanstack/react-start/server")
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env) {
      const cfEnv = ctx.cloudflare.env as Partial<ElectricEnv>
      ELECTRIC_URL = cfEnv.ELECTRIC_URL
      ELECTRIC_SOURCE_ID = cfEnv.ELECTRIC_SOURCE_ID
      ELECTRIC_SOURCE_SECRET = cfEnv.ELECTRIC_SOURCE_SECRET
    }
  } catch {
    // Not in Cloudflare context
  }

  // Fall back to process.env (local dev)
  return {
    ELECTRIC_URL: ELECTRIC_URL ?? process.env.ELECTRIC_URL,
    ELECTRIC_SOURCE_ID: ELECTRIC_SOURCE_ID ?? process.env.ELECTRIC_SOURCE_ID,
    ELECTRIC_SOURCE_SECRET:
      ELECTRIC_SOURCE_SECRET ?? process.env.ELECTRIC_SOURCE_SECRET,
  }
}

export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const env = getElectricEnv()
  const electricUrl = env.ELECTRIC_URL ?? "http://localhost:3100"
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  if (env.ELECTRIC_SOURCE_ID && env.ELECTRIC_SOURCE_SECRET) {
    originUrl.searchParams.set("source_id", env.ELECTRIC_SOURCE_ID)
    originUrl.searchParams.set("secret", env.ELECTRIC_SOURCE_SECRET)
  }

  return originUrl
}

const buildCorsHeaders = (request?: Request) => {
  const headers = new Headers()
  const origin = request?.headers.get("origin")

  if (origin) {
    headers.set("access-control-allow-origin", origin)
    headers.set("access-control-allow-credentials", "true")
  } else {
    headers.set("access-control-allow-origin", "*")
  }

  const requestedHeaders =
    request?.headers.get("access-control-request-headers") ?? DEFAULT_ALLOW_HEADERS
  headers.set("access-control-allow-headers", requestedHeaders)
  headers.set("access-control-allow-methods", "GET,OPTIONS")

  return headers
}

export const optionsResponse = (request?: Request) =>
  new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  })

export async function proxyElectricRequest(
  originUrl: URL,
  request?: Request,
): Promise<Response> {
  const response = await fetch(originUrl)
  const headers = new Headers(response.headers)
  const corsHeaders = buildCorsHeaders(request)

  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.set("vary", "cookie")
  corsHeaders.forEach((value, key) => headers.set(key, value))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
