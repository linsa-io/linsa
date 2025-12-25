import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "fs"

/**
 * API endpoint for stream-guard Rust server to upload live stream chunks
 * Chunks are stored temporarily and then synced to Jazz FileStream by client
 */

const STORAGE_PATH = "/Users/nikiv/fork-i/garden-co/jazz/glide-storage/stream-recordings"

interface StreamChunk {
  streamId: string
  chunkIndex: number
  data: string // base64 encoded video data
  timestamp: number
  metadata?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
  }
}

interface StreamMetadata {
  streamId: string
  title: string
  startedAt: number
  streamKey: string
  metadata?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
  }
}

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_PATH, { recursive: true })
}

// POST /api/stream-recording/start - Start a new recording session
const startRecording = async ({ request }: { request: Request }) => {
  try {
    const body = (await request.json()) as StreamMetadata

    if (!body.streamId || !body.title || !body.streamKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: streamId, title, streamKey" }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    await ensureStorageDir()

    // Create metadata file for this stream
    const metadataPath = `${STORAGE_PATH}/${body.streamId}-metadata.json`
    const metadata = {
      ...body,
      chunks: [],
      status: "recording",
    }

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    // Create chunks directory for this stream
    const chunksDir = `${STORAGE_PATH}/${body.streamId}`
    await fs.mkdir(chunksDir, { recursive: true })

    console.log(`[stream-recording] Started recording: ${body.streamId}`)

    return new Response(
      JSON.stringify({ success: true, streamId: body.streamId }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  } catch (error) {
    console.error("[stream-recording] Start error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    )
  }
}

// POST /api/stream-recording/chunk - Upload a video chunk
const uploadChunk = async ({ request }: { request: Request }) => {
  try {
    const body = (await request.json()) as StreamChunk

    if (!body.streamId || body.chunkIndex === undefined || !body.data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: streamId, chunkIndex, data" }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    await ensureStorageDir()

    // Write chunk to disk
    const chunkPath = `${STORAGE_PATH}/${body.streamId}/chunk-${String(body.chunkIndex).padStart(6, "0")}.bin`
    const chunkData = Buffer.from(body.data, "base64")
    await fs.writeFile(chunkPath, chunkData)

    // Update metadata with chunk info
    const metadataPath = `${STORAGE_PATH}/${body.streamId}-metadata.json`
    try {
      const metadataContent = await fs.readFile(metadataPath, "utf-8")
      const metadata = JSON.parse(metadataContent)
      metadata.chunks.push({
        index: body.chunkIndex,
        timestamp: body.timestamp,
        size: chunkData.length,
      })
      metadata.lastChunkAt = body.timestamp
      if (body.metadata) {
        metadata.metadata = { ...metadata.metadata, ...body.metadata }
      }
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    } catch (err) {
      console.warn(`[stream-recording] Could not update metadata for ${body.streamId}:`, err)
    }

    return new Response(
      JSON.stringify({ success: true, chunkIndex: body.chunkIndex }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  } catch (error) {
    console.error("[stream-recording] Chunk upload error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    )
  }
}

// POST /api/stream-recording/end - End a recording session
const endRecording = async ({ request }: { request: Request }) => {
  try {
    const body = (await request.json()) as { streamId: string; endedAt: number }

    if (!body.streamId || !body.endedAt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: streamId, endedAt" }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    }

    // Update metadata to mark as ended
    const metadataPath = `${STORAGE_PATH}/${body.streamId}-metadata.json`
    try {
      const metadataContent = await fs.readFile(metadataPath, "utf-8")
      const metadata = JSON.parse(metadataContent)
      metadata.endedAt = body.endedAt
      metadata.status = "ended"
      metadata.durationMs = body.endedAt - metadata.startedAt
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))

      console.log(`[stream-recording] Ended recording: ${body.streamId}`)

      return new Response(
        JSON.stringify({ success: true, streamId: body.streamId }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Stream not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      )
    }
  } catch (error) {
    console.error("[stream-recording] End error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    )
  }
}

// GET /api/stream-recording/list - List all recordings
const listRecordings = async ({ request }: { request: Request }) => {
  try {
    await ensureStorageDir()

    const files = await fs.readdir(STORAGE_PATH)
    const metadataFiles = files.filter((f) => f.endsWith("-metadata.json"))

    const recordings = []
    for (const file of metadataFiles) {
      try {
        const content = await fs.readFile(`${STORAGE_PATH}/${file}`, "utf-8")
        const metadata = JSON.parse(content)
        recordings.push(metadata)
      } catch (err) {
        console.warn(`[stream-recording] Could not read ${file}:`, err)
      }
    }

    return new Response(
      JSON.stringify({ recordings }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  } catch (error) {
    console.error("[stream-recording] List error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    )
  }
}

export const Route = createFileRoute("/api/stream-recording")({
  server: {
    handlers: {
      GET: listRecordings,
      POST: (ctx) => {
        const url = new URL(ctx.request.url)
        const action = url.searchParams.get("action")

        switch (action) {
          case "start":
            return startRecording(ctx)
          case "chunk":
            return uploadChunk(ctx)
          case "end":
            return endRecording(ctx)
          default:
            return new Response(
              JSON.stringify({ error: "Invalid action. Use ?action=start|chunk|end" }),
              { status: 400, headers: { "content-type": "application/json" } }
            )
        }
      },
    },
  },
})
