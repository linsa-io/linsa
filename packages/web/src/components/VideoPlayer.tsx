import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"

interface VideoPlayerProps {
  src: string
  autoPlay?: boolean
  muted?: boolean
  onReady?: () => void
}

export function VideoPlayer({
  src,
  autoPlay = true,
  muted = false,
  onReady,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(muted)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSoftFullscreen, setIsSoftFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const softFullscreenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSoftFullscreenTimeout = () => {
    if (softFullscreenTimeoutRef.current) {
      clearTimeout(softFullscreenTimeoutRef.current)
      softFullscreenTimeoutRef.current = null
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let hasCalledReady = false
    const callReady = () => {
      if (!hasCalledReady) {
        hasCalledReady = true
        onReady?.()
      }
    }

    // Check if native HLS is supported (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src
      // Call ready when video can play
      video.addEventListener("canplay", callReady, { once: true })
      if (autoPlay) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false))
      }
      return
    }

    // Use HLS.js for other browsers
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
      })

      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Call ready as soon as manifest is parsed
        callReady()
        if (autoPlay) {
          video.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false))
        }
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Network error - retrying...")
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Media error - recovering...")
              hls.recoverMediaError()
              break
            default:
              setError("Stream error")
              hls.destroy()
              break
          }
        }
      })

      hlsRef.current = hls

      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    } else {
      setError("HLS playback not supported in this browser")
    }
  }, [src, autoPlay, onReady])

  useEffect(() => {
    return () => {
      clearSoftFullscreenTimeout()
    }
  }, [])

  useEffect(() => {
    if (!isSoftFullscreen || typeof document === "undefined") return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isSoftFullscreen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
    }
    const videoEl = video as HTMLVideoElement & {
      webkitDisplayingFullscreen?: boolean
    }

    const updateFullscreenState = () => {
      const isDocFullscreen = !!doc.fullscreenElement || !!doc.webkitFullscreenElement
      const isVideoFullscreen = !!videoEl.webkitDisplayingFullscreen
      const isNowFullscreen = isDocFullscreen || isVideoFullscreen
      setIsFullscreen(isNowFullscreen)
      if (isNowFullscreen) {
        clearSoftFullscreenTimeout()
        setIsSoftFullscreen(false)
      }
    }

    const onWebkitBegin = () => {
      clearSoftFullscreenTimeout()
      video.controls = true
      setIsFullscreen(true)
      setIsSoftFullscreen(false)
    }
    const onWebkitEnd = () => {
      video.controls = false
      setIsFullscreen(false)
      setIsSoftFullscreen(false)
    }

    document.addEventListener("fullscreenchange", updateFullscreenState)
    document.addEventListener("webkitfullscreenchange", updateFullscreenState)
    video.addEventListener("webkitbeginfullscreen", onWebkitBegin as EventListener)
    video.addEventListener("webkitendfullscreen", onWebkitEnd as EventListener)

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState)
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState)
      video.removeEventListener("webkitbeginfullscreen", onWebkitBegin as EventListener)
      video.removeEventListener("webkitendfullscreen", onWebkitEnd as EventListener)
    }
  }, [])

  const handlePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().then(() => setIsPlaying(true))
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    if (newVolume === 0) {
      setIsMuted(true)
      video.muted = true
    } else if (isMuted) {
      setIsMuted(false)
      video.muted = false
    }
  }

  const handleFullscreen = async () => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return
    clearSoftFullscreenTimeout()

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null
      webkitExitFullscreen?: () => void
    }
    const videoEl = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
      webkitExitFullscreen?: () => void
      webkitRequestFullscreen?: () => Promise<void> | void
      webkitDisplayingFullscreen?: boolean
    }
    const containerEl = container as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
    }

    const isDocFullscreen = !!doc.fullscreenElement || !!doc.webkitFullscreenElement
    const isVideoFullscreen = !!videoEl.webkitDisplayingFullscreen
    const isAppleMobile =
      typeof navigator !== "undefined" &&
      (/iP(ad|hone|od)/.test(navigator.userAgent) ||
        (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1))

    if (isDocFullscreen) {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen()
      }
      setIsFullscreen(false)
      return
    }

    if (isVideoFullscreen) {
      if (videoEl.webkitExitFullscreen) {
        videoEl.webkitExitFullscreen()
      }
      setIsFullscreen(false)
      return
    }

    if (isSoftFullscreen) {
      setIsSoftFullscreen(false)
      return
    }

    const scheduleSoftFullscreenFallback = () => {
      softFullscreenTimeoutRef.current = setTimeout(() => {
        const isDocFullscreenNow = !!doc.fullscreenElement || !!doc.webkitFullscreenElement
        const isVideoFullscreenNow = !!videoEl.webkitDisplayingFullscreen
        if (!isDocFullscreenNow && !isVideoFullscreenNow) {
          video.controls = false
          setIsSoftFullscreen(true)
        }
      }, 400)
    }

    if (isAppleMobile && videoEl.webkitEnterFullscreen) {
      try {
        video.controls = true
        if (video.paused) {
          video.play().then(() => setIsPlaying(true)).catch(() => {})
        }
        videoEl.webkitEnterFullscreen()
        scheduleSoftFullscreenFallback()
        return
      } catch {
        video.controls = false
        // Fall back to other fullscreen methods.
      }
    }

    const requestContainerFullscreen = async () => {
      if (containerEl.requestFullscreen) {
        await containerEl.requestFullscreen()
        return true
      }
      if (containerEl.webkitRequestFullscreen) {
        await containerEl.webkitRequestFullscreen()
        return true
      }
      return false
    }

    try {
      if (await requestContainerFullscreen()) {
        if (!!doc.fullscreenElement || !!doc.webkitFullscreenElement) {
          setIsFullscreen(true)
          return
        }
        setIsSoftFullscreen(true)
        return
      }
    } catch {
      // Fall through to video fullscreen methods.
    }

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen()
        setIsFullscreen(true)
      } else if (videoEl.webkitRequestFullscreen) {
        await videoEl.webkitRequestFullscreen()
        setIsFullscreen(true)
      } else if (videoEl.webkitEnterFullscreen) {
        videoEl.webkitEnterFullscreen()
        setIsFullscreen(true)
        scheduleSoftFullscreenFallback()
      } else {
        setIsSoftFullscreen(true)
      }
    } catch {
      setIsSoftFullscreen(true)
    }
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  const isFullscreenActive = isFullscreen || isSoftFullscreen

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-400">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`group bg-black ${
        isSoftFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "relative h-full w-full"
      }`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted={isMuted}
        onClick={handlePlayPause}
      />

      {/* Controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="text-white transition-transform hover:scale-110"
          >
            {isPlaying ? (
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Live indicator */}
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase text-white">
            Live
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMute}
              className="text-white transition-transform hover:scale-110"
            >
              {isMuted || volume === 0 ? (
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 accent-white"
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="text-white transition-transform hover:scale-110"
          >
            {isFullscreenActive ? (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Big play button when paused */}
      {!isPlaying && (
        <button
          onClick={handlePlayPause}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 p-4 backdrop-blur-sm transition-transform hover:scale-110"
        >
          <svg className="h-16 w-16 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </div>
  )
}
