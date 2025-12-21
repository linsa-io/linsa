import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { getStreamByUsername, type StreamPageData } from "@/lib/stream/db"
import { VideoPlayer } from "@/components/VideoPlayer"

export const Route = createFileRoute("/$username")({
  ssr: false,
  component: StreamPage,
})

// Cloudflare Stream HLS URL
const HLS_URL = "https://customer-xctsztqzu046isdc.cloudflarestream.com/bb7858eafc85de6c92963f3817477b5d/manifest/video.m3u8"

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
    // Special handling for nikiv - hardcoded stream
    if (username === "nikiv") {
      setData(NIKIV_DATA)
      setLoading(false)
      // Check if stream is actually live
      fetch(HLS_URL)
        .then((res) => setStreamReady(res.ok))
        .catch(() => setStreamReady(false))
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await getStreamByUsername(username)
        setData(result)
        if (result?.stream?.hls_url) {
          const res = await fetch(result.stream.hls_url)
          setStreamReady(res.ok)
        }
      } catch (err) {
        setError("Failed to load stream")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
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

  return (
    <div className="h-screen w-screen bg-black">
      {stream?.is_live && stream.hls_url && streamReady ? (
        <VideoPlayer src={stream.hls_url} muted={false} />
      ) : stream?.is_live && stream.hls_url ? (
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
