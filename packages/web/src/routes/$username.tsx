import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { getStreamByUsername, type StreamPageData } from "@/lib/stream/db"
import { VideoPlayer } from "@/components/VideoPlayer"
import { CloudflareStreamPlayer } from "@/components/CloudflareStreamPlayer"
import { WebRTCPlayer } from "@/components/WebRTCPlayer"
import { resolveStreamPlayback } from "@/lib/stream/playback"
import { JazzProvider } from "@/lib/jazz/provider"
import { ViewerCount } from "@/components/ViewerCount"
import { CommentBox } from "@/components/CommentBox"
import {
  getSpotifyNowPlaying,
  type SpotifyNowPlayingResponse,
} from "@/lib/spotify/now-playing"
import { getStreamStatus } from "@/lib/stream/status"

export const Route = createFileRoute("/$username")({
  ssr: false,
  component: StreamPage,
})

// Cloudflare Stream HLS URL
const HLS_URL = "https://customer-xctsztqzu046isdc.cloudflarestream.com/bb7858eafc85de6c92963f3817477b5d/manifest/video.m3u8"
const NIKIV_PLAYBACK = resolveStreamPlayback({ hlsUrl: HLS_URL, webrtcUrl: null })
const READY_PULSE_MS = 1200

// Hardcoded user for nikiv
const NIKIV_DATA: StreamPageData = {
  user: {
    id: "nikiv",
    name: "Nikita",
    username: "nikiv",
    image: null,
  },
  stream: {
    id: "nikiv-stream",
    title: "Live Coding",
    description: "Building in public",
    is_live: false, // Set to true when actually streaming
    viewer_count: 0,
    hls_url: HLS_URL,
    webrtc_url: null,
    playback: NIKIV_PLAYBACK,
    thumbnail_url: null,
    started_at: null,
  },
}

function StreamPage() {
  const { username } = Route.useParams()
  const [data, setData] = useState<StreamPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false)
  const [webRtcFailed, setWebRtcFailed] = useState(false)
  const [hlsLive, setHlsLive] = useState<boolean | null>(null)
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlayingResponse | null>(
    null,
  )
  const [nowPlayingLoading, setNowPlayingLoading] = useState(false)
  const [nowPlayingError, setNowPlayingError] = useState(false)
  const [streamLive, setStreamLive] = useState(false)
  const [showReadyPulse, setShowReadyPulse] = useState(false)
  const readyPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let isActive = true
    const setReadySafe = (ready: boolean) => {
      if (isActive) {
        setStreamReady(ready)
      }
    }
    const setDataSafe = (next: StreamPageData | null) => {
      if (isActive) {
        setData(next)
      }
    }
    const setLoadingSafe = (next: boolean) => {
      if (isActive) {
        setLoading(next)
      }
    }
    const setErrorSafe = (next: string | null) => {
      if (isActive) {
        setError(next)
      }
    }
    const setWebRtcFailedSafe = (next: boolean) => {
      if (isActive) {
        setWebRtcFailed(next)
      }
    }

    setReadySafe(false)
    setWebRtcFailedSafe(false)

    // Special handling for nikiv - hardcoded stream
    if (username === "nikiv") {
      setDataSafe(NIKIV_DATA)
      setLoadingSafe(false)

      return () => {
        isActive = false
      }
    }

    const loadData = async () => {
      setLoadingSafe(true)
      setErrorSafe(null)
      try {
        const result = await getStreamByUsername(username)
        setDataSafe(result)
      } catch (err) {
        setErrorSafe("Failed to load stream")
        console.error(err)
      } finally {
        setLoadingSafe(false)
      }
    }
    loadData()

    return () => {
      isActive = false
    }
  }, [username])

  // Poll stream status for nikiv from nikiv.dev/api/stream-status
  useEffect(() => {
    if (username !== "nikiv") {
      return
    }

    let isActive = true

    const fetchStatus = async () => {
      const status = await getStreamStatus()
      if (isActive) {
        setStreamLive(status.isLive)
      }
    }

    // Fetch immediately
    fetchStatus()

    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [username])

  useEffect(() => {
    if (readyPulseTimeoutRef.current) {
      clearTimeout(readyPulseTimeoutRef.current)
      readyPulseTimeoutRef.current = null
    }

    if (!streamReady) {
      setShowReadyPulse(false)
      return
    }

    setShowReadyPulse(true)
    readyPulseTimeoutRef.current = setTimeout(() => {
      setShowReadyPulse(false)
      readyPulseTimeoutRef.current = null
    }, READY_PULSE_MS)

    return () => {
      if (readyPulseTimeoutRef.current) {
        clearTimeout(readyPulseTimeoutRef.current)
        readyPulseTimeoutRef.current = null
      }
    }
  }, [streamReady])

  const stream = data?.stream ?? null
  const playback = stream?.playback ?? null
  const fallbackPlayback = stream?.hls_url
    ? { type: "hls", url: stream.hls_url }
    : null
  const activePlayback =
    playback?.type === "webrtc" && webRtcFailed
      ? fallbackPlayback ?? playback
      : playback

  const isHlsPlaylistLive = (manifest: string) => {
    const upper = manifest.toUpperCase()
    const hasEndlist = upper.includes("#EXT-X-ENDLIST")
    const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
    const hasSegments =
      upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
    return !hasEndlist && !isVod && hasSegments
  }

  useEffect(() => {
    let isActive = true
    if (!activePlayback || activePlayback.type !== "hls") {
      return () => {
        isActive = false
      }
    }

    setStreamReady(false)
    setHlsLive(null)
    fetch(activePlayback.url)
      .then(async (res) => {
        if (isActive) {
          if (!res.ok) {
            setStreamReady(false)
            setHlsLive(false)
            return
          }
          const manifest = await res.text()
          if (!isActive) return
          const live = isHlsPlaylistLive(manifest)
          setStreamReady(live)
          setHlsLive(live)
        }
      })
      .catch(() => {
        if (isActive) {
          setStreamReady(false)
          setHlsLive(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [
    activePlayback?.type,
    activePlayback?.type === "hls" ? activePlayback.url : null,
  ])

  useEffect(() => {
    let isActive = true
    if (!stream?.hls_url || activePlayback?.type === "hls") {
      return () => {
        isActive = false
      }
    }

    setHlsLive(null)
    fetch(stream.hls_url)
      .then(async (res) => {
        if (!isActive) return
        if (!res.ok) {
          setHlsLive(false)
          return
        }
        const manifest = await res.text()
        if (!isActive) return
        setHlsLive(isHlsPlaylistLive(manifest))
      })
      .catch(() => {
        if (isActive) {
          setHlsLive(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [activePlayback?.type, stream?.hls_url])

  // For nikiv, use streamLive from the polled API status
  // For other users, use stream?.is_live from the database
  const isLiveStatus = username === "nikiv" ? streamLive : Boolean(stream?.is_live)
  const isActuallyLive =
    isLiveStatus && (activePlayback?.type !== "hls" || hlsLive !== false)
  const shouldFetchSpotify = username === "nikiv" && !isActuallyLive

  useEffect(() => {
    if (!shouldFetchSpotify) {
      setNowPlaying(null)
      setNowPlayingLoading(false)
      setNowPlayingError(false)
      return
    }

    let isActive = true

    const fetchNowPlaying = async (showLoading: boolean) => {
      if (showLoading) {
        setNowPlayingLoading(true)
      }
      try {
        const response = await getSpotifyNowPlaying()
        if (!isActive) return
        setNowPlaying(response)
        setNowPlayingError(false)
      } catch (err) {
        if (!isActive) return
        console.error("Failed to load Spotify now playing", err)
        setNowPlayingError(true)
      } finally {
        if (isActive && showLoading) {
          setNowPlayingLoading(false)
        }
      }
    }

    fetchNowPlaying(true)
    const interval = setInterval(() => fetchNowPlaying(false), 30000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [shouldFetchSpotify])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Error</h1>
          <p className="mt-2 text-neutral-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">User not found</h1>
          <p className="mt-2 text-neutral-400">
            This username doesn't exist or hasn't set up streaming.
          </p>
        </div>
      </div>
    )
  }

  const showPlayer =
    activePlayback?.type === "cloudflare" ||
    activePlayback?.type === "webrtc" ||
    (activePlayback?.type === "hls" && streamReady)
  const nowPlayingTrack = nowPlaying?.track ?? null
  const nowPlayingArtists = nowPlayingTrack?.artists.length
    ? nowPlayingTrack.artists.join(", ")
    : null
  const nowPlayingText = nowPlayingTrack
    ? nowPlayingArtists
      ? `${nowPlayingArtists} — ${nowPlayingTrack.title}`
      : nowPlayingTrack.title
    : null

  return (
    <JazzProvider>
      <div className="h-screen w-screen bg-black flex">
        {/* Main content area */}
        <div className="flex-1 relative">
          {/* Viewer count overlay */}
          <div className="absolute top-4 right-4 z-10 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
            <ViewerCount username={username} />
          </div>

          {isActuallyLive && activePlayback && showPlayer ? (
          activePlayback.type === "webrtc" ? (
            <div className="relative h-full w-full">
              <WebRTCPlayer
                src={activePlayback.url}
                muted={false}
                onReady={() => setStreamReady(true)}
                onError={() => {
                  setWebRtcFailed(true)
                  setStreamReady(!fallbackPlayback)
                }}
              />
              {!streamReady && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                  <div className="animate-pulse text-4xl">🟡</div>
                </div>
              )}
              {showReadyPulse && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                </div>
              )}
            </div>
          ) : activePlayback.type === "cloudflare" ? (
            <div className="relative h-full w-full">
              <CloudflareStreamPlayer
                uid={activePlayback.uid}
                customerCode={activePlayback.customerCode}
                muted={false}
                onReady={() => setStreamReady(true)}
              />
              {!streamReady && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                  <div className="animate-pulse text-4xl">🟡</div>
                </div>
              )}
              {showReadyPulse && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-full w-full">
              <VideoPlayer src={activePlayback.url} muted={false} />
              {showReadyPulse && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                </div>
              )}
            </div>
          )
        ) : isActuallyLive && activePlayback ? (
          <div className="flex h-full w-full items-center justify-center text-white">
            <div className="animate-pulse text-4xl">🟡</div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white">
            {shouldFetchSpotify ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-neutral-400">
                  <span className="h-2 w-2 rounded-full bg-neutral-500" />
                  Offline
                </div>
                <p className="mt-6 text-3xl font-semibold">
                  Not live right now
                </p>
                <div className="mt-6 text-lg text-neutral-300">
                  {nowPlayingLoading ? (
                    <span>Checking Spotify...</span>
                  ) : nowPlaying?.isPlaying && nowPlayingTrack ? (
                    <span>
                      Currently playing{" "}
                      {nowPlayingTrack.url ? (
                        <a
                          href={nowPlayingTrack.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white hover:text-neutral-300 transition-colors"
                        >
                          {nowPlayingText ?? "Spotify"}
                        </a>
                      ) : (
                        <span className="text-white">
                          {nowPlayingText ?? "Spotify"}
                        </span>
                      )}
                    </span>
                  ) : nowPlayingError ? (
                    <span>Spotify status unavailable right now.</span>
                  ) : (
                    <span>Not playing anything right now.</span>
                  )}
                </div>

                <a
                  href="https://nikiv.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 text-3xl font-medium text-white hover:text-neutral-300 transition-colors"
                >
                  nikiv.dev
                </a>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-medium text-neutral-400 mb-6">
                  stream soon
                </p>
                <a
                  href={username === "nikiv" ? "https://nikiv.dev" : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-4xl font-medium text-white hover:text-neutral-300 transition-colors"
                >
                  {username === "nikiv" ? "nikiv.dev" : `@${username}`}
                </a>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Chat sidebar */}
        <div className="w-80 h-full border-l border-white/10 flex-shrink-0">
          <CommentBox username={username} />
        </div>
      </div>
    </JazzProvider>
  )
}
