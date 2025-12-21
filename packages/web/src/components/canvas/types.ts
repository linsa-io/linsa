import type {
  SerializedCanvasImage,
  SerializedCanvasRecord,
} from "@/lib/canvas/types"

export type CanvasBox = SerializedCanvasImage & {
  isGenerating?: boolean
}

export type CanvasSnapshot = SerializedCanvasRecord
