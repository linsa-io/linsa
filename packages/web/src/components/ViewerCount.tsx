import { useStreamViewers } from "@/lib/jazz/useStreamViewers"

interface ViewerCountProps {
  username: string
}

/**
 * Displays the real-time viewer count for a stream
 */
export function ViewerCount({ username }: ViewerCountProps) {
  const { viewerCount, isConnected, isLoading } = useStreamViewers(username)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-neutral-400">
        <div className="h-2 w-2 rounded-full bg-neutral-500 animate-pulse" />
        <span className="text-sm">...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected ? "bg-green-500" : "bg-neutral-500"
        }`}
      />
      <span className="text-sm text-neutral-300">
        {viewerCount} {viewerCount === 1 ? "viewer" : "viewers"}
      </span>
    </div>
  )
}
