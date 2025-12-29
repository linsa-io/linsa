/**
 * Save Safari tabs as bookmarks to Linsa
 *
 * Usage:
 *   LINSA_API_KEY=lk_xxx pnpm tsx tests/bookmarks-save.ts
 *
 * Or via flow:
 *   f save-tabs
 */

import { executeJxa } from "@nikiv/ts-utils"

const API_URL = process.env.LINSA_API_URL || "http://localhost:5613"
const API_KEY = process.env.LINSA_API_KEY

if (!API_KEY) {
  console.error("Error: LINSA_API_KEY environment variable is required")
  console.error("Generate one at /settings or via: f gen-api-key")
  process.exit(1)
}

type LocalTab = {
  uuid: string
  title: string
  url: string
  window_id: number
  index: number
  is_local: boolean
}

async function fetchSafariTabs(): Promise<LocalTab[]> {
  return executeJxa(`
    const safari = Application("com.apple.Safari");
    const tabs = [];
    safari.windows().map(window => {
      const windowTabs = window.tabs();
      if (windowTabs) {
        return windowTabs.map(tab => {
          tabs.push({
            uuid: window.id() + '-' + tab.index(),
            title: tab.name(),
            url: tab.url() || '',
            window_id: window.id(),
            index: tab.index(),
            is_local: true
          });
        })
      }
    });
    return tabs;
  `)
}

async function saveBookmark(tab: LocalTab, sessionTag: string): Promise<boolean> {
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
      console.error(`  ✗ Failed: ${error.error || response.status}`)
      return false
    }

    return true
  } catch (error) {
    console.error(`  ✗ Error:`, error instanceof Error ? error.message : error)
    return false
  }
}

async function main() {
  console.log("Getting Safari tabs...")
  const tabs = await fetchSafariTabs()

  if (tabs.length === 0) {
    console.log("No Safari tabs found. Make sure Safari is running with tabs open.")
    return
  }

  console.log(`Found ${tabs.length} tabs across ${new Set(tabs.map((t) => t.window_id)).size} windows`)

  // Create session tag with timestamp
  const date = new Date()
  const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`
  const sessionTag = `session-${timestamp}`

  console.log(`\nSaving to Linsa with tag: ${sessionTag}`)
  console.log(`API URL: ${API_URL}`)
  console.log("")

  let saved = 0
  let skipped = 0
  let failed = 0

  for (const tab of tabs) {
    // Skip empty URLs, about: pages, favorites
    if (!tab.url || tab.url.startsWith("about:") || tab.url === "favorites://") {
      skipped++
      continue
    }

    const shortTitle = tab.title.length > 50 ? tab.title.slice(0, 47) + "..." : tab.title
    process.stdout.write(`  ${shortTitle} `)

    const success = await saveBookmark(tab, sessionTag)

    if (success) {
      console.log("✓")
      saved++
    } else {
      failed++
    }
  }

  console.log("")
  console.log(`Done! Saved: ${saved}, Skipped: ${skipped}, Failed: ${failed}`)
  console.log(`Session tag: ${sessionTag}`)
}

main().catch(console.error)
