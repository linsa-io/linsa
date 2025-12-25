export interface StreamStatus {
  isLive: boolean
  updatedAt?: string
}

/**
 * Fetches stream status via local API proxy (avoids CORS)
 * This is set by Lin when streaming starts/stops
 */
export async function getStreamStatus(): Promise<StreamStatus> {
  try {
    const response = await fetch("/api/stream-status", {
      cache: "no-store",
    })
    if (!response.ok) {
      return { isLive: false }
    }
    const data = await response.json()
    return {
      isLive: Boolean(data.isLive),
      updatedAt: data.updatedAt,
    }
  } catch (error) {
    console.error("Failed to fetch stream status:", error)
    return { isLive: false }
  }
}
