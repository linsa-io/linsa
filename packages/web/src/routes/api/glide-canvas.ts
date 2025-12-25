import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "fs"
import { join } from "path"
import type { GlideCanvasItem } from "@/lib/jazz/schema"

// Local storage for pending Glide canvas items (to be synced to Jazz by client)
const STORAGE_PATH = "/Users/nikiv/fork-i/garden-co/jazz/glide-storage/pending-canvas-items.json"

async function readPendingItems(): Promise<GlideCanvasItem[]> {
  try {
    const data = await fs.readFile(STORAGE_PATH, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist or is invalid - return empty array
    return []
  }
}

async function writePendingItems(items: GlideCanvasItem[]): Promise<void> {
  await fs.writeFile(STORAGE_PATH, JSON.stringify(items, null, 2), "utf-8")
}

// POST add canvas item (from Glide browser)
const addCanvasItem = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const item = body as GlideCanvasItem

    // Validate required fields
    if (!item.id || !item.type || !item.title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: id, type, title" }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // Read current pending items
    const items = await readPendingItems()

    // Check if item already exists (by id)
    const existingIndex = items.findIndex((i) => i.id === item.id)
    if (existingIndex >= 0) {
      // Update existing item
      items[existingIndex] = item
    } else {
      // Add new item
      items.push(item)
    }

    // Write back to file
    await writePendingItems(items)

    console.log("[glide-canvas] Stored item:", {
      id: item.id,
      type: item.type,
      title: item.title,
      hasImage: !!item.imageData,
    })

    return new Response(JSON.stringify({ success: true, id: item.id }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Glide canvas POST error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

// GET retrieve pending canvas items (for client-side Jazz sync)
const getCanvasItems = async ({ request }: { request: Request }) => {
  try {
    const items = await readPendingItems()
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Glide canvas GET error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

// DELETE clear pending items (after sync to Jazz)
const clearCanvasItems = async ({ request }: { request: Request }) => {
  try {
    await writePendingItems([])
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    console.error("Glide canvas DELETE error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/glide-canvas")({
  server: {
    handlers: {
      GET: getCanvasItems,
      POST: addCanvasItem,
      DELETE: clearCanvasItems,
    },
  },
})
