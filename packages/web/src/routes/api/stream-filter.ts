import { json } from "@tanstack/react-start"
import type { APIContext } from "@tanstack/react-router"

/**
 * Get or update stream filter configuration (allowed/blocked apps)
 * 
 * GET: Returns current filter config from Jazz (or hardcoded default)
 * PUT: Updates filter config in Jazz
 */

// Hardcoded default for nikiv (will be in Jazz later)
const DEFAULT_FILTER = {
  allowedApps: ["zed", "cursor", "xcode", "safari", "warp", "warpPreview"],
  blockedApps: ["1password", "keychain", "telegram"],
  audioApps: ["spotify", "arc"],
  version: 1,
  updatedAt: Date.now(),
}

export async function GET({ request }: APIContext) {
  try {
    // TODO: Read from Jazz when worker is set up
    return json(DEFAULT_FILTER)
  } catch (error) {
    return json({ error: "Failed to fetch filter config" }, { status: 500 })
  }
}

export async function PUT({ request }: APIContext) {
  try {
    const body = await request.json()
    const { allowedApps, blockedApps, audioApps } = body

    // TODO: Write to Jazz when worker is set up
    // For now, return the updated config
    return json({
      success: true,
      allowedApps: allowedApps || [],
      blockedApps: blockedApps || [],
      audioApps: audioApps || [],
      version: DEFAULT_FILTER.version + 1,
      updatedAt: Date.now(),
    })
  } catch (error) {
    return json({ error: "Failed to update filter config" }, { status: 500 })
  }
}
