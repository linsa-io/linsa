// Canvas configuration constants
export const CANVAS_CONFIG = {
  // Initial sizing
  INITIAL_SIZE: 254,
  MIN_WIDTH: 254,
  MIN_HEIGHT: 254,
  MAX_PIXEL_WIDTH: 1000,
  MAX_PIXEL_HEIGHT: 1000,

  // Visual styling
  HANDLE_COLOR: "#6366F1", // indigo-500
  OUTLINE_COLOR: "rgba(99,102,241,0.7)", // indigo-500 with opacity

  // Handle sizing
  HANDLE_SIZE: 8,
  EDGE_HANDLE_THICKNESS: 2,

  // Animation settings
  ANIMATION_DURATION: 0.2,
  SPRING_STIFFNESS: 200,
  SPRING_DAMPING: 22,

  // History settings
  MAX_HISTORY_SIZE: 50,
} as const

export type CanvasRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasItem = {
  id: string
  rect: CanvasRect
  description?: string
  imageUrl?: string
}
