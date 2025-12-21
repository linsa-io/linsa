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
  const handleReady = () => {
    onReady?.()
  }

  return (
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
  )
}
