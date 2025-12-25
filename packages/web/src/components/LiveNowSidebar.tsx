import { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { Radio, X } from "lucide-react"

const DISMISS_KEY = "linsa_live_dismissed"
const DISMISS_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface LiveNowSidebarProps {
  /** Don't show on the nikiv page itself */
  currentUsername?: string
}

export function LiveNowSidebar({ currentUsername }: LiveNowSidebarProps) {
  const [isLive, setIsLive] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden to avoid flash

  // Check if dismissed
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    if (stored) {
      const dismissedAt = parseInt(stored, 10)
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) {
        setIsDismissed(true)
        return
      }
    }
    setIsDismissed(false)
  }, [])

  // Check live status
  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const response = await fetch("/api/check-hls")
        if (response.ok) {
          const data = await response.json()
          setIsLive(Boolean(data.isLive))
        }
      } catch {
        // Ignore errors
      }
    }

    checkLiveStatus()
    const interval = setInterval(checkLiveStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }

  // Don't show if not live, dismissed, or already on nikiv's page
  if (!isLive || isDismissed || currentUsername === "nikiv") {
    return null
  }

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 hidden md:block">
      <Link
        to="/nikiv"
        className="block p-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-red-500/50 transition-all group relative"
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 p-1 bg-black/80 border border-white/10 rounded-full text-white/50 hover:text-white hover:border-white/30 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <Radio className="w-4 h-4 text-red-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Live Now</span>
        </div>
        <div className="flex items-center gap-3">
          <img
            src="https://nikiv.dev/nikiv.jpg"
            alt="nikiv"
            className="w-12 h-12 rounded-full border-2 border-red-500/50 group-hover:border-red-500 transition-colors"
          />
          <div>
            <p className="font-semibold text-white">nikiv</p>
            <p className="text-xs text-white/60">Streaming now</p>
          </div>
        </div>
      </Link>
    </div>
  )
}
