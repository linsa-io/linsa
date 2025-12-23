import { useEffect, useRef, useState } from "react"

type WebRTCPlayerProps = {
  src: string
  autoPlay?: boolean
  muted?: boolean
  onReady?: () => void
  onError?: (message: string) => void
}

const splitHeaderParts = (value: string) => {
  const parts: string[] = []
  let current = ""
  let inQuotes = false
  for (const char of value) {
    if (char === "\"") {
      inQuotes = !inQuotes
    }
    if (char === "," && !inQuotes) {
      if (current.trim()) {
        parts.push(current.trim())
      }
      current = ""
      continue
    }
    current += char
  }
  if (current.trim()) {
    parts.push(current.trim())
  }
  return parts
}

const stripQuotes = (value: string) => {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1)
  }
  return value
}

const parseIceServersFromLinkHeader = (header: string | null): RTCIceServer[] => {
  if (!header) return []
  const servers: RTCIceServer[] = []

  for (const part of splitHeaderParts(header)) {
    const urlMatch = part.match(/<([^>]+)>/)
    if (!urlMatch) continue

    const url = urlMatch[1].trim()
    const params = part.split(";").map((item) => item.trim())
    let rel = ""
    let username = ""
    let credential = ""
    let credentialType = ""

    for (const param of params.slice(1)) {
      const [key, ...rest] = param.split("=")
      if (!key) continue
      const value = stripQuotes(rest.join("=").trim())
      if (key === "rel") rel = value
      if (key === "username") username = value
      if (key === "credential") credential = value
      if (key === "credential-type") credentialType = value
    }

    if (!rel.includes("ice-server")) continue

    const server: RTCIceServer = { urls: url }
    if (username) server.username = username
    if (credential) server.credential = credential
    if (credentialType) {
      server.credentialType = credentialType as RTCIceCredentialType
    }
    servers.push(server)
  }

  return servers
}

export function WebRTCPlayer({
  src,
  autoPlay = true,
  muted = false,
  onReady,
  onError,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let pc: RTCPeerConnection | null = null
    let sessionUrl: string | null = null
    const abortController = new AbortController()
    readyRef.current = false

    const markReady = () => {
      if (readyRef.current) return
      readyRef.current = true
      onReady?.()
    }

    const reportError = (message: string) => {
      if (abortController.signal.aborted) return
      setError(message)
      onError?.(message)
    }

    const cleanup = () => {
      abortController.abort()
      if (sessionUrl) {
        fetch(sessionUrl, { method: "DELETE" }).catch(() => {})
      }
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

    const getIceServers = async () => {
      try {
        const response = await fetch(src, {
          method: "OPTIONS",
          signal: abortController.signal,
        })
        if (!response.ok) {
          return []
        }
        return parseIceServersFromLinkHeader(response.headers.get("Link"))
      } catch {
        return []
      }
    }

    const start = async () => {
      try {
        setError(null)

        const iceServers = await getIceServers()
        pc = new RTCPeerConnection(iceServers.length ? { iceServers } : undefined)

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
          } else if (pc?.connectionState === "failed") {
            reportError("WebRTC connection failed")
          }
        }

        pc.oniceconnectionstatechange = () => {
          if (!pc) return
          if (pc.iceConnectionState === "failed") {
            reportError("WebRTC ICE failed")
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
            accept: "application/sdp",
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

        const locationHeader = response.headers.get("Location")
        if (locationHeader) {
          sessionUrl = new URL(locationHeader, src).toString()
        }

        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
      } catch (err) {
        if (!abortController.signal.aborted) {
          const message = err instanceof Error ? err.message : "WebRTC failed"
          reportError(message)
        }
      }
    }

    start()

    return cleanup
  }, [autoPlay, muted, onError, onReady, src])

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
