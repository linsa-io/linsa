import { asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db/connection"
import { canvas, canvas_images } from "@/db/schema"
import type {
  CanvasPoint,
  CanvasSize,
  SerializedCanvas,
  SerializedCanvasImage,
  SerializedCanvasRecord,
  SerializedCanvasSummary,
} from "./types"

const DEFAULT_POSITION: CanvasPoint = { x: 0, y: 0 }
const DEFAULT_IMAGE_SIZE: CanvasSize = { width: 512, height: 512 }
const DEFAULT_IMAGE_NAME = "Box 1"
const DEFAULT_MODEL = "gemini-2.5-flash-image-preview"

const resolveDatabaseUrl = () => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Record<string, string> } } | null
    }
    const ctx = getServerContext()
    const url = ctx?.cloudflare?.env?.DATABASE_URL
    if (url) {
      return url
    }
  } catch {
    // probably not running inside server context
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  throw new Error("DATABASE_URL is not configured")
}

const db = () => getDb(resolveDatabaseUrl())

type DatabaseClient = ReturnType<typeof db>

const parsePoint = (value: unknown): CanvasPoint => {
  if (
    value &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    typeof (value as any).x === "number" &&
    typeof (value as any).y === "number"
  ) {
    return { x: (value as any).x, y: (value as any).y }
  }
  return DEFAULT_POSITION
}

const serializeCanvasRecord = (record: typeof canvas.$inferSelect): SerializedCanvasRecord => ({
  id: record.id,
  name: record.name,
  ownerId: record.owner_id,
  defaultModel: record.default_model,
  defaultStyle: record.default_style,
  backgroundPrompt: record.background_prompt,
  width: record.width,
  height: record.height,
  createdAt: record.created_at.toISOString(),
  updatedAt: record.updated_at.toISOString(),
})

const serializeImage = (image: typeof canvas_images.$inferSelect): SerializedCanvasImage => ({
  id: image.id,
  canvasId: image.canvas_id,
  name: image.name,
  prompt: image.prompt,
  modelId: image.model_id,
  modelUsed: image.model_used,
  styleId: image.style_id,
  width: image.width,
  height: image.height,
  rotation: image.rotation,
  position: parsePoint(image.position),
  branchParentId: image.branch_parent_id,
  metadata: (image.metadata as Record<string, unknown> | null) ?? null,
  imageUrl: image.image_url,
  imageData: image.content_base64 ?? null,
  createdAt: image.created_at.toISOString(),
  updatedAt: image.updated_at.toISOString(),
})

const createCanvasWithDefaults = async (
  params: {
    ownerId: string
    name?: string
    database?: DatabaseClient
  },
): Promise<SerializedCanvas> => {
  const database = params.database ?? db()
  const [createdCanvas] = await database
    .insert(canvas)
    .values({
      owner_id: params.ownerId,
      name: params.name ?? "Untitled Canvas",
    })
    .returning()

  const [createdImage] = await database
    .insert(canvas_images)
    .values({
      canvas_id: createdCanvas.id,
      name: DEFAULT_IMAGE_NAME,
      prompt: "",
      position: DEFAULT_POSITION,
      width: DEFAULT_IMAGE_SIZE.width,
      height: DEFAULT_IMAGE_SIZE.height,
      model_id: DEFAULT_MODEL,
      style_id: "default",
    })
    .returning()

  return {
    canvas: serializeCanvasRecord(createdCanvas),
    images: [serializeImage(createdImage)],
  }
}

export async function getOrCreateCanvasForUser(userId: string): Promise<SerializedCanvas> {
  const database = db()
  const existing = await database
    .select()
    .from(canvas)
    .where(eq(canvas.owner_id, userId))
    .limit(1)

  if (existing.length > 0) {
    const images = await database
      .select()
      .from(canvas_images)
      .where(eq(canvas_images.canvas_id, existing[0].id))
      .orderBy(asc(canvas_images.created_at))

    return {
      canvas: serializeCanvasRecord(existing[0]),
      images: images.map(serializeImage),
    }
  }

  return createCanvasWithDefaults({ ownerId: userId, database })
}

export async function getCanvasSnapshotById(canvasId: string): Promise<SerializedCanvas | null> {
  const database = db()
  const records = await database.select().from(canvas).where(eq(canvas.id, canvasId)).limit(1)
  if (records.length === 0) {
    return null
  }
  const images = await database
    .select()
    .from(canvas_images)
    .where(eq(canvas_images.canvas_id, canvasId))
    .orderBy(asc(canvas_images.created_at))

  return {
    canvas: serializeCanvasRecord(records[0]),
    images: images.map(serializeImage),
  }
}

export async function createCanvasForUser(params: {
  userId: string
  name?: string
}): Promise<SerializedCanvas> {
  return createCanvasWithDefaults({ ownerId: params.userId, name: params.name })
}

export async function listCanvasesForUser(userId: string): Promise<SerializedCanvasSummary[]> {
  const database = db()
  const records = await database
    .select()
    .from(canvas)
    .where(eq(canvas.owner_id, userId))
    .orderBy(desc(canvas.updated_at))

  if (records.length === 0) {
    const created = await createCanvasWithDefaults({ ownerId: userId, database })
    return [
      {
        canvas: created.canvas,
        previewImage: created.images[0] ?? null,
        imageCount: created.images.length,
      },
    ]
  }

  const canvasIds = records.map((record) => record.id)
  const previewMap = new Map<string, SerializedCanvasImage>()
  const countMap = new Map<string, number>()

  if (canvasIds.length > 0) {
    const images = await database
      .select()
      .from(canvas_images)
      .where(inArray(canvas_images.canvas_id, canvasIds))
      .orderBy(desc(canvas_images.updated_at))

    for (const image of images) {
      const serialized = serializeImage(image)
      const parentCanvasId = serialized.canvasId
      countMap.set(parentCanvasId, (countMap.get(parentCanvasId) ?? 0) + 1)
      if (!previewMap.has(parentCanvasId)) {
        previewMap.set(parentCanvasId, serialized)
      }
    }
  }

  return records.map((record) => ({
    canvas: serializeCanvasRecord(record),
    previewImage: previewMap.get(record.id) ?? null,
    imageCount: countMap.get(record.id) ?? 0,
  }))
}

export async function createCanvasImage(params: {
  canvasId: string
  name?: string
  prompt?: string
  position?: CanvasPoint
  size?: CanvasSize
  modelId?: string
  styleId?: string
  branchParentId?: string | null
}): Promise<SerializedCanvasImage> {
  const database = db()
  const [image] = await database
    .insert(canvas_images)
    .values({
      canvas_id: params.canvasId,
      name: params.name ?? DEFAULT_IMAGE_NAME,
      prompt: params.prompt ?? "",
      position: params.position ?? DEFAULT_POSITION,
      width: params.size?.width ?? DEFAULT_IMAGE_SIZE.width,
      height: params.size?.height ?? DEFAULT_IMAGE_SIZE.height,
      model_id: params.modelId ?? DEFAULT_MODEL,
      style_id: params.styleId ?? "default",
      branch_parent_id: params.branchParentId ?? null,
    })
    .returning()

  return serializeImage(image)
}

export async function updateCanvasImage(params: {
  imageId: string
  data: {
    name?: string
    prompt?: string
    modelId?: string
    modelUsed?: string | null
    styleId?: string
    position?: CanvasPoint
    size?: CanvasSize
    rotation?: number
    metadata?: Record<string, unknown> | null
    branchParentId?: string | null
    imageDataBase64?: string | null
    imageUrl?: string | null
  }
}): Promise<SerializedCanvasImage> {
  const database = db()
  const values: Partial<typeof canvas_images.$inferInsert> = {
    updated_at: new Date(),
  }

  if (params.data.name !== undefined) values.name = params.data.name
  if (params.data.prompt !== undefined) values.prompt = params.data.prompt
  if (params.data.modelId !== undefined) values.model_id = params.data.modelId
  if (params.data.modelUsed !== undefined) values.model_used = params.data.modelUsed
  if (params.data.styleId !== undefined) values.style_id = params.data.styleId
  if (params.data.position) values.position = params.data.position
  if (params.data.size) {
    values.width = params.data.size.width
    values.height = params.data.size.height
  }
  if (typeof params.data.rotation === "number") {
    values.rotation = params.data.rotation
  }
  if (params.data.metadata !== undefined) {
    values.metadata = params.data.metadata ?? null
  }
  if (params.data.branchParentId !== undefined) {
    values.branch_parent_id = params.data.branchParentId
  }
  if (params.data.imageDataBase64 !== undefined) {
    values.content_base64 = params.data.imageDataBase64 ?? null
  }
  if (params.data.imageUrl !== undefined) {
    values.image_url = params.data.imageUrl
  }

  const [updated] = await database
    .update(canvas_images)
    .set(values)
    .where(eq(canvas_images.id, params.imageId))
    .returning()

  return serializeImage(updated)
}

export async function deleteCanvasImage(imageId: string) {
  const database = db()
  await database.delete(canvas_images).where(eq(canvas_images.id, imageId))
}

export async function updateCanvasRecord(params: {
  canvasId: string
  data: {
    name?: string
    width?: number
    height?: number
    defaultModel?: string
    defaultStyle?: string
    backgroundPrompt?: string | null
  }
}): Promise<SerializedCanvasRecord> {
  const database = db()
  const values: Partial<typeof canvas.$inferInsert> = {
    updated_at: new Date(),
  }

  if (params.data.name !== undefined) values.name = params.data.name
  if (params.data.width !== undefined) values.width = params.data.width
  if (params.data.height !== undefined) values.height = params.data.height
  if (params.data.defaultModel !== undefined) values.default_model = params.data.defaultModel
  if (params.data.defaultStyle !== undefined) values.default_style = params.data.defaultStyle
  if (params.data.backgroundPrompt !== undefined)
    values.background_prompt = params.data.backgroundPrompt

  const [record] = await database
    .update(canvas)
    .set(values)
    .where(eq(canvas.id, params.canvasId))
    .returning()

  return serializeCanvasRecord(record)
}

export async function getCanvasOwner(canvasId: string) {
  const database = db()
  const [record] = await database
    .select({ ownerId: canvas.owner_id })
    .from(canvas)
    .where(eq(canvas.id, canvasId))
    .limit(1)
  return record ?? null
}

export async function getCanvasImageRecord(imageId: string) {
  const database = db()
  const [record] = await database
    .select()
    .from(canvas_images)
    .where(eq(canvas_images.id, imageId))
    .limit(1)
  return record ?? null
}
