import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { getStreamByUsername, type StreamPageData } from "@/lib/stream/db"
import { VideoPlayer } from "@/components/VideoPlayer"
import { JazzProvider } from "@/lib/jazz/provider"
import { CommentBox } from "@/components/CommentBox"
import { ProfileSidebar } from "@/components/ProfileSidebar"
import { authClient } from "@/lib/auth-client"
import { MessageCircle, LogIn, X, User } from "lucide-react"

export const Route = createFileRoute("/$username")({
  ssr: false,
  component: StreamPage,
})

const READY_PULSE_MS = 1200

function StreamPage() {
  const { username } = Route.useParams()
  const { data: session } = authClient.useSession()
  const [data, setData] = useState<StreamPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [hlsLive, setHlsLive] = useState<boolean | null>(null)
  const [hlsUrl, setHlsUrl] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showReadyPulse, setShowReadyPulse] = useState(false)
  const readyPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasConnectedOnce = useRef(false)

  // Mobile overlays
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showMobileProfile, setShowMobileProfile] = useState(false)

  const isAuthenticated = !!session?.user

  // Fetch user and stream data from API
  useEffect(() => {
    let isActive = true

    const loadData = async () => {
      if (!isActive) return
      setLoading(true)
      setError(null)
      try {
        const result = await getStreamByUsername(username)
        if (isActive) {
          setData(result)
          if (result?.stream?.hls_url) {
            setHlsUrl(result.stream.hls_url)
          }
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

  // Ready pulse animation
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
  const activePlayback = hlsUrl
    ? { type: "hls" as const, url: hlsUrl }
    : stream?.playback ?? null

  // Poll HLS status via server-side API (avoids CORS issues)
  useEffect(() => {
    if (!data?.user) return

    let isActive = true

    const checkHls = async () => {
      try {
        const res = await fetch(`/api/streams/${username}/check-hls`, { cache: "no-store" })
        if (!isActive) return

        const apiData = await res.json()

        // Update HLS URL if returned from API
        if (apiData.hlsUrl && apiData.hlsUrl !== hlsUrl) {
          setHlsUrl(apiData.hlsUrl)
        }

        if (apiData.isLive) {
          if (!hasConnectedOnce.current) {
            setIsConnecting(true)
          }
          setHlsLive(true)
        } else {
          if (!hasConnectedOnce.current) {
            setHlsLive(false)
          }
        }
      } catch {
        // Silently ignore errors
      }
    }

    setHlsLive(null)
    checkHls()

    // Poll every 5 seconds
    const interval = setInterval(checkHls, 5000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [data?.user, username, hlsUrl])

  // Determine if stream is actually live
  const isActuallyLive = hlsLive === true || Boolean(stream?.is_live)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
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

  const handlePlayerReady = () => {
    hasConnectedOnce.current = true
    setIsConnecting(false)
    setPlayerReady(true)
  }

  const isChecking = hlsLive === null

  // Build profile user object
  const profileUser = {
    id: data.user.id,
    name: data.user.name,
    username: data.user.username ?? username,
    image: data.user.image,
    bio: data.user.bio ?? null,
    website: data.user.website ?? null,
    location: data.user.location ?? null,
    joinedAt: data.user.joinedAt ?? null,
  }

  return (
    <JazzProvider>
      <div className="h-screen w-screen bg-black flex flex-col md:flex-row">
        {/* Main content area - Stream */}
        <div className="flex-1 relative min-h-0">
          {isChecking ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-white">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <p className="mt-6 text-lg text-neutral-400">Checking stream status...</p>
            </div>
          ) : isActuallyLive && activePlayback ? (
            <div className="relative h-full w-full">
              <VideoPlayer
                src={activePlayback.url}
                muted={false}
                onReady={handlePlayerReady}
              />
              {(isConnecting || !playerReady) && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-red-500 rounded-full animate-spin" />
                  </div>
                  <p className="mt-6 text-lg text-white">Connecting to stream...</p>
                </div>
              )}
              {showReadyPulse && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white pb-16 md:pb-0">
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-neutral-400">
                  <span className="h-2 w-2 rounded-full bg-neutral-500" />
                  Offline
                </div>
                <p className="mt-6 text-2xl md:text-3xl font-semibold">
                  Not live right now
                </p>
                {profileUser.website && (
                  <a
                    href={profileUser.website.startsWith("http") ? profileUser.website : `https://${profileUser.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 text-2xl md:text-3xl font-medium text-white hover:text-neutral-300 transition-colors"
                  >
                    {profileUser.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Profile Sidebar with Chat */}
        <div className="hidden md:flex w-96 h-full flex-shrink-0">
          <ProfileSidebar
            user={profileUser}
            isLive={isActuallyLive}
          >
            <CommentBox username={username} />
          </ProfileSidebar>
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4">
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
          <button
            type="button"
            onClick={() => setShowMobileProfile(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            <User className="w-4 h-4" />
            Profile
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

        {/* Mobile profile overlay */}
        {showMobileProfile && (
          <div className="md:hidden fixed inset-0 z-40 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-medium">Profile</span>
              <button
                type="button"
                onClick={() => setShowMobileProfile(false)}
                className="p-2 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <ProfileSidebar
                user={profileUser}
                isLive={isActuallyLive}
              />
            </div>
          </div>
        )}
      </div>
    </JazzProvider>
  )
}
