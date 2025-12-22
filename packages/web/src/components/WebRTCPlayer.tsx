import { useEffect, useRef, useState } from "react"

type WebRTCPlayerProps = {
  src: string
  autoPlay?: boolean
  muted?: boolean
  onReady?: () => void
}

export function WebRTCPlayer({
  src,
  autoPlay = true,
  muted = false,
  onReady,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let pc: RTCPeerConnection | null = new RTCPeerConnection()
    const abortController = new AbortController()
    readyRef.current = false

    const markReady = () => {
      if (readyRef.current) return
      readyRef.current = true
      onReady?.()
    }

    const cleanup = () => {
      abortController.abort()
      if (pc) {
        pc.ontrack = null
        pc.onconnectionstatechange = null
        pc.oniceconnectionstatechange = null
        pc.close()
      }
      pc = null
      if (video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
        video.srcObject = null
      }
    }

    const waitForIceGathering = () =>
      new Promise<void>((resolve) => {
        if (!pc || pc.iceGatheringState === "complete") {
          resolve()
          return
        }
        const onStateChange = () => {
          if (!pc) return
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", onStateChange)
            resolve()
          }
        }
        pc.addEventListener("icegatheringstatechange", onStateChange)
      })

    const start = async () => {
      try {
        if (!pc) return
        setError(null)

        pc.addTransceiver("video", { direction: "recvonly" })
        pc.addTransceiver("audio", { direction: "recvonly" })

        pc.ontrack = (event) => {
          const [stream] = event.streams
          if (stream && video.srcObject !== stream) {
            video.srcObject = stream
            video.muted = muted
            if (autoPlay) {
              video.play().catch(() => {})
            }
            markReady()
          }
        }

        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === "connected") {
            markReady()
          }
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGathering()

        const localSdp = pc.localDescription?.sdp
        if (!localSdp) {
          throw new Error("Missing local SDP")
        }

        const response = await fetch(src, {
          method: "POST",
          headers: {
            "content-type": "application/sdp",
          },
          body: localSdp,
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`WebRTC request failed (${response.status})`)
        }

        const answerSdp = await response.text()
        if (!answerSdp) {
          throw new Error("Empty WebRTC answer")
        }

        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
      } catch (err) {
        if (!abortController.signal.aborted) {
          const message = err instanceof Error ? err.message : "WebRTC failed"
          setError(message)
        }
      }
    }

    start()

    return cleanup
  }, [autoPlay, muted, onReady, src])

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-neutral-400">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-contain"
      autoPlay={autoPlay}
      muted={muted}
      playsInline
    />
  )
}
