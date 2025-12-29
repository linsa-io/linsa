/**
 * Test script to save Safari tabs as bookmarks to Linsa
 *
 * Usage:
 *   pnpm tsx tests/bookmarks-save.ts
 *
 * Requires:
 *   - LINSA_API_KEY environment variable (or create one at /settings)
 *   - Safari running with tabs open
 */

import { execSync } from "node:child_process"

const API_URL = process.env.LINSA_API_URL || "http://localhost:5613"
const API_KEY = process.env.LINSA_API_KEY

if (!API_KEY) {
  console.error("Error: LINSA_API_KEY environment variable is required")
  console.error("Generate one at /settings or via POST /api/api-keys")
  process.exit(1)
}

interface SafariTab {
  title: string
  url: string
  windowIndex: number
}

// Get Safari tabs using AppleScript
function getSafariTabs(): SafariTab[] {
  const script = `
    tell application "Safari"
      set tabList to {}
      set windowCount to count of windows
      repeat with w from 1 to windowCount
        set tabCount to count of tabs of window w
        repeat with t from 1 to tabCount
          set tabTitle to name of tab t of window w
          set tabURL to URL of tab t of window w
          set end of tabList to {windowIndex:w, title:tabTitle, url:tabURL}
        end repeat
      end repeat
      return tabList
    end tell
  `

  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      timeout: 10000,
    })

    // Parse AppleScript output: {{windowIndex:1, title:"...", url:"..."}, ...}
    const tabs: SafariTab[] = []

    // AppleScript returns records in format: window index:1, title:..., url:...
    const matches = result.matchAll(
      /window ?[iI]ndex:(\d+),\s*title:(.*?),\s*url:(.*?)(?=,\s*window|$)/g
    )

    for (const match of matches) {
      tabs.push({
        windowIndex: parseInt(match[1]),
        title: match[2].trim(),
        url: match[3].trim(),
      })
    }

    // If regex didn't work, try simpler line-by-line parsing
    if (tabs.length === 0) {
      // Alternative: get just URLs and titles separately
      const urlScript = `
        tell application "Safari"
          set urls to {}
          repeat with w in windows
            repeat with t in tabs of w
              set end of urls to URL of t
            end repeat
          end repeat
          return urls
        end tell
      `
      const titleScript = `
        tell application "Safari"
          set titles to {}
          repeat with w in windows
            repeat with t in tabs of w
              set end of titles to name of t
            end repeat
          end repeat
          return titles
        end tell
      `

      const urlsRaw = execSync(`osascript -e '${urlScript.replace(/'/g, "'\\''")}'`, {
        encoding: "utf-8",
      }).trim()

      const titlesRaw = execSync(`osascript -e '${titleScript.replace(/'/g, "'\\''")}'`, {
        encoding: "utf-8",
      }).trim()

      // Parse comma-separated lists
      const urls = urlsRaw.split(", ").filter(Boolean)
      const titles = titlesRaw.split(", ").filter(Boolean)

      for (let i = 0; i < urls.length; i++) {
        tabs.push({
          windowIndex: 1,
          title: titles[i] || "",
          url: urls[i],
        })
      }
    }

    return tabs
  } catch (error) {
    console.error("Failed to get Safari tabs:", error)
    return []
  }
}

// Save a bookmark to Linsa
async function saveBookmark(tab: SafariTab, sessionTag: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/bookmarks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title,
        tags: `safari,${sessionTag}`,
        api_key: API_KEY,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error(`Failed to save ${tab.url}:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`Failed to save ${tab.url}:`, error)
    return false
  }
}

async function main() {
  console.log("Getting Safari tabs...")
  const tabs = getSafariTabs()

  if (tabs.length === 0) {
    console.log("No Safari tabs found. Make sure Safari is running with tabs open.")
    return
  }

  console.log(`Found ${tabs.length} tabs`)

  // Create session tag with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const sessionTag = `session-${timestamp}`

  console.log(`Saving to Linsa with tag: ${sessionTag}`)
  console.log(`API URL: ${API_URL}`)
  console.log("")

  let saved = 0
  let failed = 0

  for (const tab of tabs) {
    // Skip empty URLs or about: pages
    if (!tab.url || tab.url.startsWith("about:") || tab.url === "favorites://") {
      continue
    }

    process.stdout.write(`  Saving: ${tab.title.slice(0, 50)}... `)
    const success = await saveBookmark(tab, sessionTag)

    if (success) {
      console.log("✓")
      saved++
    } else {
      console.log("✗")
      failed++
    }
  }

  console.log("")
  console.log(`Done! Saved ${saved} bookmarks, ${failed} failed`)
  console.log(`Session tag: ${sessionTag}`)
}

main().catch(console.error)
