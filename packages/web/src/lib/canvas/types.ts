export type CanvasPoint = {
  x: number
  y: number
}

export type CanvasSize = {
  width: number
  height: number
}

export type SerializedCanvasRecord = {
  id: string
  name: string
  ownerId: string
  defaultModel: string
  defaultStyle: string
  backgroundPrompt: string | null
  width: number
  height: number
  createdAt: string
  updatedAt: string
}

export type SerializedCanvasImage = {
  id: string
  canvasId: string
  name: string
  prompt: string
  modelId: string
  modelUsed: string | null
  styleId: string
  width: number
  height: number
  rotation: number
  position: CanvasPoint
  branchParentId: string | null
  metadata: Record<string, unknown> | null
  imageUrl: string | null
  imageData: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedCanvas = {
  canvas: SerializedCanvasRecord
  images: SerializedCanvasImage[]
}

export type SerializedCanvasSummary = {
  canvas: SerializedCanvasRecord
  previewImage: SerializedCanvasImage | null
  imageCount: number
}
