import { json } from "@tanstack/react-start"
import type { APIContext } from "@tanstack/react-router"

/**
 * Get or set Cloudflare stream configuration from Jazz
 * 
 * GET: Returns current Cloudflare Live Input UID
 * PUT: Updates Cloudflare Live Input UID
 */
export async function GET({ request, context }: APIContext) {
  try {
    // For now, return the hardcoded value
    // TODO: Read from Jazz when worker is set up
    return json({
      liveInputUid: "bb7858eafc85de6c92963f3817477b5d",
      customerCode: "xctsztqzu046isdc",
      name: "linsa-nikiv",
      updatedAt: Date.now(),
    })
  } catch (error) {
    return json({ error: "Failed to fetch config" }, { status: 500 })
  }
}

export async function PUT({ request, context }: APIContext) {
  try {
    const body = await request.json()
    const { liveInputUid, customerCode, name } = body

    // TODO: Write to Jazz when worker is set up
    // For now, just return success
    return json({
      success: true,
      liveInputUid,
      customerCode,
      name,
      updatedAt: Date.now(),
    })
  } catch (error) {
    return json({ error: "Failed to update config" }, { status: 500 })
  }
}
