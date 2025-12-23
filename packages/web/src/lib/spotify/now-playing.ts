export type SpotifyNowPlayingTrack = {
  id: string | null
  title: string
  artists: string[]
  album: string | null
  imageUrl: string | null
  url: string | null
  type: "track" | "episode"
}

export type SpotifyNowPlayingResponse = {
  isPlaying: boolean
  track: SpotifyNowPlayingTrack | null
}

export async function getSpotifyNowPlaying(): Promise<SpotifyNowPlayingResponse> {
  const response = await fetch("/api/spotify/now-playing", {
    credentials: "include",
  })

  if (response.status === 204) {
    return { isPlaying: false, track: null }
  }

  if (!response.ok) {
    throw new Error("Failed to load Spotify now playing")
  }

  return response.json()
}
