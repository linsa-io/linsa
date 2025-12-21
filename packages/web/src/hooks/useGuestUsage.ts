import { useState, useEffect, useCallback } from "react"

const GUEST_USAGE_KEY = "gen_guest_usage"
const GUEST_FREE_LIMIT = 5

type GuestUsage = {
  count: number
  lastReset: string // ISO date string
}

function getStoredUsage(): GuestUsage {
  if (typeof window === "undefined") {
    return { count: 0, lastReset: new Date().toISOString() }
  }

  try {
    const stored = localStorage.getItem(GUEST_USAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as GuestUsage
    }
  } catch {
    // Invalid data, reset
  }

  return { count: 0, lastReset: new Date().toISOString() }
}

function setStoredUsage(usage: GuestUsage): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(usage))
  } catch {
    // localStorage might be full or disabled
  }
}

export function useGuestUsage() {
  const [usage, setUsage] = useState<GuestUsage>(getStoredUsage)

  useEffect(() => {
    setUsage(getStoredUsage())
  }, [])

  const remaining = Math.max(0, GUEST_FREE_LIMIT - usage.count)
  const canUse = remaining > 0

  const incrementUsage = useCallback(() => {
    setUsage((prev) => {
      const newUsage = {
        count: prev.count + 1,
        lastReset: prev.lastReset,
      }
      setStoredUsage(newUsage)
      return newUsage
    })
  }, [])

  const resetUsage = useCallback(() => {
    const newUsage = { count: 0, lastReset: new Date().toISOString() }
    setStoredUsage(newUsage)
    setUsage(newUsage)
  }, [])

  return {
    used: usage.count,
    remaining,
    limit: GUEST_FREE_LIMIT,
    canUse,
    incrementUsage,
    resetUsage,
  }
}
