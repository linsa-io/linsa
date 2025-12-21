import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { getStreamByUsername, type StreamPageData } from "@/lib/stream/db"
import { VideoPlayer } from "@/components/VideoPlayer"
import { CloudflareStreamPlayer } from "@/components/CloudflareStreamPlayer"
import { resolveStreamPlayback } from "@/lib/stream/playback"

export const Route = createFileRoute("/$username")({
  ssr: false,
  component: StreamPage,
})

// Cloudflare Stream HLS URL
const HLS_URL = "https://customer-xctsztqzu046isdc.cloudflarestream.com/bb7858eafc85de6c92963f3817477b5d/manifest/video.m3u8"
const NIKIV_PLAYBACK = resolveStreamPlayback({ hlsUrl: HLS_URL })

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
    is_live: true,
    viewer_count: 0,
    hls_url: HLS_URL,
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

    setReadySafe(false)

    // Special handling for nikiv - hardcoded stream
    if (username === "nikiv") {
      setDataSafe(NIKIV_DATA)
      setLoadingSafe(false)

      if (NIKIV_PLAYBACK?.type === "hls") {
        fetch(NIKIV_PLAYBACK.url)
          .then((res) => setReadySafe(res.ok))
          .catch(() => setReadySafe(false))
      }

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

        const playback = result?.stream?.playback
        if (playback?.type === "hls") {
          const res = await fetch(playback.url)
          setReadySafe(res.ok)
        } else {
          setReadySafe(false)
        }
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

  const { user, stream } = data
  const playback = stream?.playback
  const showPlayer =
    playback?.type === "cloudflare" || (playback?.type === "hls" && streamReady)

  return (
    <div className="h-screen w-screen bg-black">
      {stream?.is_live && playback && showPlayer ? (
        playback.type === "cloudflare" ? (
          <div className="relative h-full w-full">
            <CloudflareStreamPlayer
              uid={playback.uid}
              customerCode={playback.customerCode}
              muted={false}
              onReady={() => setStreamReady(true)}
            />
            {!streamReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="animate-pulse text-4xl">🔴</div>
                  <p className="mt-4 text-xl text-neutral-400">
                    Connecting to stream...
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <VideoPlayer src={playback.url} muted={false} />
        )
      ) : stream?.is_live && playback ? (
        <div className="flex h-full w-full items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-pulse text-4xl">🔴</div>
            <p className="mt-4 text-xl text-neutral-400">
              Connecting to stream...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white">
          <div className="text-center">
            <p className="text-2xl font-medium">Streaming soon</p>
            <a
              href="https://nikiv.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-lg text-neutral-400 underline hover:text-white transition-colors"
            >
              nikiv.dev
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
