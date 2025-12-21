import type {
  SerializedCanvas,
  SerializedCanvasImage,
  SerializedCanvasSummary,
} from "./types"

const jsonHeaders = { "content-type": "application/json" }

const handleJson = async (response: Response) => {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Canvas request failed")
  }
  return (await response.json()) as any
}

export const fetchCanvasSnapshot = async (
  canvasId: string,
): Promise<SerializedCanvas> => {
  const res = await fetch(`/api/canvas/${canvasId}`, {
    credentials: "include",
  })
  const data = await handleJson(res)
  return data as SerializedCanvas
}

export const fetchCanvasList = async (): Promise<SerializedCanvasSummary[]> => {
  const res = await fetch("/api/canvas", { credentials: "include" })
  const data = await handleJson(res)
  return data.canvases as SerializedCanvasSummary[]
}

export const createCanvasProject = async (params: {
  name?: string
} = {}): Promise<SerializedCanvas> => {
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({ name: params.name }),
  })
  const data = await handleJson(res)
  return data as SerializedCanvas
}

export const createCanvasBox = async (params: {
  canvasId: string
  name?: string
  prompt?: string
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  modelId?: string
  styleId?: string
  branchParentId?: string | null
}): Promise<SerializedCanvasImage> => {
  const res = await fetch("/api/canvas/images", {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(params),
  })
  const data = await handleJson(res)
  return data.image as SerializedCanvasImage
}

export const updateCanvasBox = async (
  imageId: string,
  data: Partial<{
    name: string
    prompt: string
    modelId: string
    styleId: string
    position: { x: number; y: number }
    size: { width: number; height: number }
    rotation: number
  }>,
): Promise<SerializedCanvasImage> => {
  const res = await fetch(`/api/canvas/images/${imageId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(data),
  })
  const json = await handleJson(res)
  return json.image as SerializedCanvasImage
}

export const deleteCanvasBox = async (imageId: string) => {
  const res = await fetch(`/api/canvas/images/${imageId}`, {
    method: "DELETE",
    headers: jsonHeaders,
    credentials: "include",
  })
  await handleJson(res)
}

export const generateCanvasBoxImage = async (params: {
  imageId: string
  prompt?: string
  modelId?: string
  temperature?: number
}): Promise<SerializedCanvasImage> => {
  const res = await fetch(`/api/canvas/images/${params.imageId}/generate`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify({
      prompt: params.prompt,
      modelId: params.modelId,
      temperature: params.temperature,
    }),
  })
  const json = await handleJson(res)
  return json.image as SerializedCanvasImage
}
