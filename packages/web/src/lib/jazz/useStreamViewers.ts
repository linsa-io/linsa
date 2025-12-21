import { useEffect, useState } from "react"
import { useAccount, useCoState } from "jazz-tools/react"
import { Group } from "jazz-tools"
import {
  PresenceFeed,
  StreamPresenceContainer,
  ViewerAccount,
} from "./schema"

/** How old a presence entry can be before considered stale (10 seconds) */
const PRESENCE_STALE_MS = 10_000

/** How often to update presence (5 seconds) */
const PRESENCE_UPDATE_MS = 5_000

interface UseStreamViewersResult {
  /** Number of active viewers */
  viewerCount: number
  /** Whether Jazz is connected */
  isConnected: boolean
  /** Whether the room is loaded */
  isLoading: boolean
}

/**
 * Hook to track and count stream viewers using Jazz presence
 *
 * @param username - The streamer's username (used as room identifier)
 * @returns Viewer count and connection status
 */
export function useStreamViewers(username: string): UseStreamViewersResult {
  const [feedId, setFeedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewerCount, setViewerCount] = useState(0)

  // Get current account
  const me = useAccount(ViewerAccount)

  // Load the presence feed directly
  const presenceFeed = useCoState(PresenceFeed, feedId ?? undefined, {
    resolve: true,
  })

  // Create or load the stream presence container
  useEffect(() => {
    if (!me.$isLoaded) return

    const loadPresenceFeed = async () => {
      setIsLoading(true)

      try {
        // Create a unique identifier for this stream's presence
        const containerUID = { stream: username, origin: "linsa.io" }

        // Create a group for this container that anyone can write to
        const group = Group.create({ owner: me })
        group.addMember("everyone", "writer")

        // Try to upsert the container (create if doesn't exist)
        const container = await StreamPresenceContainer.upsertUnique({
          value: {
            presenceFeed: [],
          },
          resolve: { presenceFeed: true },
          unique: containerUID,
          owner: group,
        })

        if (container.$isLoaded && container.$jazz.refs.presenceFeed) {
          setFeedId(container.$jazz.refs.presenceFeed.id)
        }
      } catch (err) {
        console.error("Failed to load presence feed:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPresenceFeed()
  }, [me.$isLoaded, me.$jazz?.id, username])

  // Update our presence periodically
  useEffect(() => {
    if (!presenceFeed?.$isLoaded) return

    const updatePresence = () => {
      try {
        presenceFeed.$jazz.push({
          lastActive: Date.now(),
        })
      } catch (err) {
        console.error("Failed to update presence:", err)
      }
    }

    // Update immediately
    updatePresence()

    // Then update periodically
    const interval = setInterval(updatePresence, PRESENCE_UPDATE_MS)

    return () => clearInterval(interval)
  }, [presenceFeed?.$isLoaded])

  // Count active viewers
  useEffect(() => {
    if (!presenceFeed?.$isLoaded) {
      setViewerCount(0)
      return
    }

    const countViewers = () => {
      const now = Date.now()
      const activeViewers = new Set<string>()

      // Get all sessions and count those with recent activity
      const perSession = presenceFeed.perSession
      if (perSession) {
        for (const sessionId of Object.keys(perSession)) {
          const entry = (presenceFeed.perSession as Record<string, { value?: { lastActive: number } }>)[sessionId]
          if (entry?.value) {
            const age = now - entry.value.lastActive
            if (age < PRESENCE_STALE_MS) {
              activeViewers.add(sessionId)
            }
          }
        }
      }

      setViewerCount(activeViewers.size)
    }

    // Count immediately
    countViewers()

    // Recount periodically
    const interval = setInterval(countViewers, 2000)

    return () => clearInterval(interval)
  }, [presenceFeed?.$isLoaded, presenceFeed])

  // Sync viewer count to database for external access
  useEffect(() => {
    if (viewerCount === 0) return

    // Debounce the API call
    const timeout = setTimeout(() => {
      fetch(`/api/streams/${username}/viewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerCount }),
      }).catch((err) => {
        console.error("Failed to sync viewer count:", err)
      })
    }, 1000)

    return () => clearTimeout(timeout)
  }, [viewerCount, username])

  return {
    viewerCount,
    isConnected: me.$isLoaded,
    isLoading,
  }
}
