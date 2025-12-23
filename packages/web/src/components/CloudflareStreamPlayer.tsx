import { useEffect, useRef } from "react"
import { Stream } from "@cloudflare/stream-react"

type CloudflareStreamPlayerProps = {
  uid: string
  customerCode?: string
  autoPlay?: boolean
  muted?: boolean
  onReady?: () => void
}

export function CloudflareStreamPlayer({
  uid,
  customerCode,
  autoPlay = true,
  muted = false,
  onReady,
}: CloudflareStreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleReady = () => {
    onReady?.()
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ensureFullscreenAllow = () => {
      const iframe = container.querySelector("iframe")
      if (!iframe) return false

      const allow = iframe.getAttribute("allow") ?? ""
      const parts = allow
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
      if (!parts.includes("fullscreen")) {
        parts.push("fullscreen")
        iframe.setAttribute("allow", parts.join("; "))
      }
      if (!iframe.hasAttribute("allowfullscreen")) {
        iframe.setAttribute("allowfullscreen", "")
      }
      return true
    }

    if (ensureFullscreenAllow()) {
      return
    }

    if (typeof MutationObserver === "undefined") {
      return
    }

    const observer = new MutationObserver(() => {
      if (ensureFullscreenAllow()) {
        observer.disconnect()
      }
    })
    observer.observe(container, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [uid, customerCode])

  return (
    <div ref={containerRef} className="h-full w-full">
      <Stream
        className="h-full w-full"
        src={uid}
        customerCode={customerCode}
        controls
        autoplay={autoPlay}
        muted={muted}
        responsive={false}
        height="100%"
        width="100%"
        onCanPlay={handleReady}
        onPlaying={handleReady}
      />
    </div>
  )
}
