import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { getStreamByUsername, type StreamPageData } from "@/lib/stream/db"
import { VideoPlayer } from "@/components/VideoPlayer"
import { CloudflareStreamPlayer } from "@/components/CloudflareStreamPlayer"
import { WebRTCPlayer } from "@/components/WebRTCPlayer"
import { LiveNowSidebar } from "@/components/LiveNowSidebar"
import { resolveStreamPlayback } from "@/lib/stream/playback"
import { JazzProvider } from "@/lib/jazz/provider"
import { ViewerCount } from "@/components/ViewerCount"
import { CommentBox } from "@/components/CommentBox"
import {
  getSpotifyNowPlaying,
  type SpotifyNowPlayingResponse,
} from "@/lib/spotify/now-playing"
import { getStreamStatus } from "@/lib/stream/status"
import { authClient } from "@/lib/auth-client"
import { MessageCircle, LogIn, X } from "lucide-react"

export const Route = createFileRoute("/$username")({
  ssr: false,
  component: StreamPage,
})

// Cloudflare Stream HLS URL
const HLS_URL = "https://customer-xctsztqzu046isdc.cloudflarestream.com/1b0363e3f8d54ddc639dc85737f8c28a/manifest/video.m3u8"
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
  const { data: session } = authClient.useSession()
  const [data, setData] = useState<StreamPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [hlsLive, setHlsLive] = useState<boolean | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlayingResponse | null>(
    null,
  )
  const [nowPlayingLoading, setNowPlayingLoading] = useState(false)
  const [nowPlayingError, setNowPlayingError] = useState(false)
  const [streamLive, setStreamLive] = useState(false)
  const [showReadyPulse, setShowReadyPulse] = useState(false)
  const readyPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasConnectedOnce = useRef(false)

  // Mobile chat overlay
  const [showMobileChat, setShowMobileChat] = useState(false)

  const isAuthenticated = !!session?.user

  useEffect(() => {
    let isActive = true

    // Special handling for nikiv - hardcoded stream
    if (username === "nikiv") {
      setData(NIKIV_DATA)
      setLoading(false)
      return () => {
        isActive = false
      }
    }

    const loadData = async () => {
      if (!isActive) return
      setLoading(true)
      setError(null)
      try {
        const result = await getStreamByUsername(username)
        if (isActive) {
          setData(result)
        }
      } catch (err) {
        if (isActive) {
          setError("Failed to load stream")
          console.error(err)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
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
      console.log("[Stream Status] nikiv.dev/api/stream-status:", status)
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

    if (!playerReady) {
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
  }, [playerReady])

  const stream = data?.stream ?? null
  // For nikiv, always use HLS directly (no WebRTC)
  const activePlayback = username === "nikiv"
    ? { type: "hls" as const, url: HLS_URL }
    : stream?.playback ?? null

  const isHlsPlaylistLive = (manifest: string) => {
    const upper = manifest.toUpperCase()
    const hasEndlist = upper.includes("#EXT-X-ENDLIST")
    const isVod = upper.includes("#EXT-X-PLAYLIST-TYPE:VOD")
    const hasSegments =
      upper.includes("#EXTINF") || upper.includes("#EXT-X-PART")
    // Also check for #EXTM3U which is the start of any valid HLS manifest
    const isValidManifest = upper.includes("#EXTM3U")
    return isValidManifest && !hasEndlist && !isVod && hasSegments
  }

  // For nikiv, use server-side API to check HLS (avoids CORS)
  useEffect(() => {
    if (username !== "nikiv") return

    let isActive = true

    const checkHlsViaApi = async () => {
      try {
        const res = await fetch("/api/check-hls", { cache: "no-store" })
        if (!isActive) return

        const data = await res.json()

        if (data.isLive) {
          // Stream is live - set connecting state if first time
          if (!hasConnectedOnce.current) {
            setIsConnecting(true)
          }
          setHlsLive(true)
        } else {
          // Only set offline if we haven't connected yet
          // This prevents flickering when HLS check temporarily fails
          if (!hasConnectedOnce.current) {
            setHlsLive(false)
          }
        }
      } catch {
        // Silently ignore errors - don't change state on network issues
      }
    }

    // Initial check
    setHlsLive(null)
    checkHlsViaApi()

    // Poll every 5 seconds to detect when stream goes live
    const interval = setInterval(checkHlsViaApi, 5000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [username])

  // For non-nikiv users, use direct HLS check
  useEffect(() => {
    if (username === "nikiv" || !activePlayback || activePlayback.type !== "hls") {
      return
    }

    let isActive = true

    const checkHlsLive = async () => {
      try {
        const res = await fetch(activePlayback.url, {
          cache: "no-store",
          mode: "cors",
        })

        if (!isActive) return

        if (!res.ok) {
          if (!hasConnectedOnce.current) {
            setHlsLive(false)
          }
          return
        }

        const manifest = await res.text()
        if (!isActive) return

        const live = isHlsPlaylistLive(manifest)
        if (live) {
          if (!hasConnectedOnce.current) {
            setIsConnecting(true)
          }
          setHlsLive(true)
        } else if (!hasConnectedOnce.current) {
          setHlsLive(false)
        }
      } catch {
        // Silently ignore fetch errors
      }
    }

    setHlsLive(null)
    checkHlsLive()

    const interval = setInterval(checkHlsLive, 5000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [
    username,
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

  // For nikiv, use HLS live check from our API
  // For other users, use stream?.is_live from the database
  const isActuallyLive = username === "nikiv"
    ? hlsLive === true
    : Boolean(stream?.is_live)

  // Only show Spotify when we know stream is offline (not during initial check)
  const shouldFetchSpotify = username === "nikiv" && !isActuallyLive && hlsLive === false

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
      } catch {
        if (!isActive) return
        // Silently handle Spotify errors - it's not critical
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

  const nowPlayingTrack = nowPlaying?.track ?? null
  const nowPlayingArtists = nowPlayingTrack?.artists.length
    ? nowPlayingTrack.artists.join(", ")
    : null
  const nowPlayingText = nowPlayingTrack
    ? nowPlayingArtists
      ? `${nowPlayingArtists} — ${nowPlayingTrack.title}`
      : nowPlayingTrack.title
    : null

  // Callback when player is ready
  const handlePlayerReady = () => {
    hasConnectedOnce.current = true
    setIsConnecting(false)
    setPlayerReady(true)
  }

  // Show loading state during initial check
  const isChecking = hlsLive === null

  return (
    <JazzProvider>
      <LiveNowSidebar currentUsername={username} />
      <div className="h-screen w-screen bg-black flex flex-col md:flex-row">
        {/* Main content area */}
        <div className="flex-1 relative min-h-0">

          {/* Viewer count overlay - hidden on mobile */}
          {isActuallyLive && (
            <div className="hidden md:block absolute top-4 right-4 z-10 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
              <ViewerCount username={username} />
            </div>
          )}

          {/* Loading state - checking if stream is live */}
          {isChecking ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-white">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <p className="mt-6 text-lg text-neutral-400">Checking stream status...</p>
            </div>
          ) : isActuallyLive && activePlayback ? (
            /* Stream is live - show the player */
            <div className="relative h-full w-full">
              <VideoPlayer
                src={activePlayback.url}
                muted={false}
                onReady={handlePlayerReady}
              />
              {/* Loading overlay while connecting */}
              {(isConnecting || !playerReady) && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-red-500 rounded-full animate-spin" />
                  </div>
                  <p className="mt-6 text-lg text-white">Connecting to stream...</p>
                </div>
              )}
              {/* Ready pulse */}
              {showReadyPulse && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                </div>
              )}
            </div>
          ) : (
            /* Stream is offline */
            <div className="flex h-full w-full items-center justify-center text-white pb-16 md:pb-0">
              {shouldFetchSpotify ? (
                <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-neutral-400">
                    <span className="h-2 w-2 rounded-full bg-neutral-500" />
                    Offline
                  </div>
                  <p className="mt-6 text-2xl md:text-3xl font-semibold">
                    Not live right now
                  </p>
                  <div className="mt-6 text-base md:text-lg text-neutral-300">
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
                    ) : null}
                  </div>

                  <a
                    href="https://nikiv.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 text-2xl md:text-3xl font-medium text-white hover:text-neutral-300 transition-colors"
                  >
                    nikiv.dev
                  </a>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-medium text-neutral-400 mb-6">
                    stream soon
                  </p>
                  <a
                    href={username === "nikiv" ? "https://nikiv.dev" : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl md:text-4xl font-medium text-white hover:text-neutral-300 transition-colors"
                  >
                    {username === "nikiv" ? "nikiv.dev" : `@${username}`}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Chat sidebar */}
        <div className="hidden md:block w-80 h-full border-l border-white/10 flex-shrink-0">
          <CommentBox username={username} />
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm border-t border-white/10 px-4 py-3 flex items-center justify-center gap-6">
          {!isAuthenticated && (
            <Link
              to="/auth"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowMobileChat(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
        </div>

        {/* Mobile chat overlay */}
        {showMobileChat && (
          <div className="md:hidden fixed inset-0 z-40 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-medium">Chat</span>
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className="p-2 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <CommentBox username={username} />
            </div>
          </div>
        )}
      </div>
    </JazzProvider>
  )
}
