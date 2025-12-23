import { createFileRoute } from "@tanstack/react-router"

type SpotifyTrack = {
  id: string | null
  title: string
  artists: string[]
  album: string | null
  imageUrl: string | null
  url: string | null
  type: "track"
}

type SpotifyNowPlayingResponse = {
  isPlaying: boolean
  track: SpotifyTrack | null
}

const JAZZ_READ_KEY = "nikiv-spotify@garden.co"

const resolveSpotifyStateId = (): string | undefined => {
  let stateId: string | undefined

  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env) {
      stateId = ctx.cloudflare.env.JAZZ_SPOTIFY_STATE_ID
    }
  } catch {
    // not in Cloudflare context
  }

  return stateId ?? process.env.JAZZ_SPOTIFY_STATE_ID
}

const parseTrackIdFromUrl = (url: string | null | undefined) => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const id = parts[1]
    if (!id) return null
    return id
  } catch {
    return null
  }
}

const buildTrackPayload = (song: string, url: string | null): SpotifyTrack => {
  const id = parseTrackIdFromUrl(url)

  const splitIndex = song.indexOf(" - ")
  const artists =
    splitIndex > 0 ? [song.slice(0, splitIndex).trim()] : []
  const title =
    splitIndex > 0 ? song.slice(splitIndex + 3).trim() : song.trim()

  return {
    id,
    title: title || song,
    artists,
    album: null,
    imageUrl: null,
    url,
    type: "track",
  }
}

const handler = async () => {
  const stateId = resolveSpotifyStateId()
  if (!stateId) {
    return new Response(JSON.stringify({ error: "Spotify not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const response = await fetch(
      `https://cloud.jazz.tools/api/value/${stateId}?key=${JAZZ_READ_KEY}`,
      { cache: "no-store" },
    )

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Spotify request failed" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      })
    }

    const data = await response.json()
    const song = typeof data?.song === "string" ? data.song : null
    const url = typeof data?.url === "string" ? data.url : null
    const track = song ? buildTrackPayload(song, url) : null

    const payload: SpotifyNowPlayingResponse = {
      isPlaying: Boolean(song && url),
      track,
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    console.error("Spotify now playing error:", error)
    return new Response(JSON.stringify({ error: "Spotify request failed" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/spotify/now-playing")({
  server: {
    handlers: {
      GET: handler,
    },
  },
})
