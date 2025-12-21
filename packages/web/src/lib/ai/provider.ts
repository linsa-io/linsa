import { createOpenRouter } from "@openrouter/ai-sdk-provider"

// Get API key from Cloudflare env or process.env
const getApiKey = (): string | undefined => {
  // Try Cloudflare Workers context first
  try {
    const { getServerContext } = require("@tanstack/react-start/server")
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env?.OPENROUTER_API_KEY) {
      return ctx.cloudflare.env.OPENROUTER_API_KEY as string
    }
  } catch {
    // Not in Cloudflare context
  }
  return process.env.OPENROUTER_API_KEY
}

const getModel = (): string => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server")
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env?.OPENROUTER_MODEL) {
      return ctx.cloudflare.env.OPENROUTER_MODEL as string
    }
  } catch {
    // Not in Cloudflare context
  }
  return process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001"
}

export const getOpenRouter = () => {
  const apiKey = getApiKey()
  if (!apiKey) {
    return null
  }
  return createOpenRouter({ apiKey })
}

export const getDefaultModel = () => getModel()
