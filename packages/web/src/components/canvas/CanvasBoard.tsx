import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { CanvasPoint, CanvasSize } from "@/lib/canvas/types"
import type { CanvasBox } from "./types"

const MIN_SIZE = 160
const HANDLE_OFFSETS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

type DragMode = "move" | "resize"

type DragState = {
  id: string
  mode: DragMode
  handle?: (typeof HANDLE_OFFSETS)[number]
  origin: CanvasPoint
  startPosition: CanvasPoint
  startSize: CanvasSize
  latestRect?: {
    position: CanvasPoint
    size: CanvasSize
  }
}

export type CanvasBoardProps = {
  boxes: CanvasBox[]
  selectedBoxId: string | null
  onSelect: (id: string | null) => void
  onRectChange: (id: string, rect: { position: CanvasPoint; size: CanvasSize }) => void
  onRectCommit: (id: string, rect: { position: CanvasPoint; size: CanvasSize }) => void
  className?: string
}

export const CanvasBoard = ({
  boxes,
  selectedBoxId,
  onSelect,
  onRectChange,
  onRectCommit,
  className,
}: CanvasBoardProps) => {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const startDrag = useCallback(
    (
      box: CanvasBox,
      mode: DragMode,
      origin: CanvasPoint,
      handle?: DragState["handle"],
    ) => {
      const state: DragState = {
        id: box.id,
        mode,
        handle,
        origin,
        startPosition: box.position,
        startSize: { width: box.width, height: box.height },
      }

      dragStateRef.current = state
      setDragState(state)
    },
    [],
  )

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current
      if (!state) return
      event.preventDefault()

      const dx = event.clientX - state.origin.x
      const dy = event.clientY - state.origin.y

      let nextPosition = state.startPosition
      let nextSize = state.startSize

      if (state.mode === "move") {
        nextPosition = {
          x: Math.max(0, Math.round(state.startPosition.x + dx)),
          y: Math.max(0, Math.round(state.startPosition.y + dy)),
        }
      } else if (state.mode === "resize" && state.handle) {
        const { size, position } = calculateResize(state, dx, dy)
        nextSize = size
        nextPosition = position
      }

      const rect = { position: nextPosition, size: nextSize }
      dragStateRef.current = { ...state, latestRect: rect }
      onRectChange(state.id, rect)
    }

    const handlePointerUp = () => {
      const state = dragStateRef.current
      if (state?.latestRect) {
        onRectCommit(state.id, state.latestRect)
      }
      dragStateRef.current = null
      setDragState(null)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [dragState, onRectChange, onRectCommit])

  const boardSize = useMemo(() => {
    const maxX = Math.max(...boxes.map((box) => box.position.x + box.width), 1600)
    const maxY = Math.max(...boxes.map((box) => box.position.y + box.height), 900)
    return { width: maxX + 480, height: maxY + 480 }
  }, [boxes])

  return (
    <div
      className={`relative flex-1 overflow-auto rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.05)_1px,_transparent_0)] ${className ?? ""}`}
      onClick={() => onSelect(null)}
      style={{ backgroundSize: "32px 32px" }}
    >
      <div
        className="relative"
        style={{ width: Math.max(boardSize.width, 1400), height: Math.max(boardSize.height, 1000) }}
      >
        {boxes.map((box) => {
          const selected = box.id === selectedBoxId

          return (
            <div
              key={box.id}
              className={`absolute rounded-[32px] border border-white/10 bg-white/5 p-3 text-white shadow-[0_30px_60px_rgba(0,0,0,0.4)] transition-shadow backdrop-blur ${selected ? "ring-2 ring-white/70" : ""}`}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(box.id)
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.preventDefault()
                event.stopPropagation()
                startDrag(box, "move", { x: event.clientX, y: event.clientY })
              }}
              style={{
                transform: `translate(${box.position.x}px, ${box.position.y}px)`,
                width: box.width,
                height: box.height,
                userSelect: "none",
                cursor: dragState?.id === box.id ? "grabbing" : "grab",
              }}
            >
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span className="font-medium text-white">{box.name}</span>
                <span>
                  {box.width}×{box.height}
                </span>
              </div>
              <div className="relative flex h-[calc(100%-24px)] items-center justify-center overflow-hidden rounded-2xl bg-black/30">
                {box.imageData ? (
                  <img
                    alt={box.name}
                    className="h-full w-full object-cover"
                    src={`data:image/png;base64,${box.imageData}`}
                  />
                ) : (
                  <div className="px-4 text-center text-sm text-white/60">
                    {box.prompt ? box.prompt : "Add a prompt and generate to see your artwork here."}
                  </div>
                )}
                {box.isGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70 text-sm font-semibold">
                    Generating…
                  </div>
                )}
              </div>
              {selected && (
                <>
                  {HANDLE_OFFSETS.map((handle) => (
                    <ResizeHandle
                      key={handle}
                      handle={handle}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        startDrag(box, "resize", { x: event.clientX, y: event.clientY }, handle)
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ResizeHandleProps = {
  handle: (typeof HANDLE_OFFSETS)[number]
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

const ResizeHandle = ({ handle, onPointerDown }: ResizeHandleProps) => {
  const positions: Record<typeof handle, string> = {
    "top-left": "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
    "top-right": "top-0 right-0 translate-x-1/2 -translate-y-1/2",
    "bottom-left": "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    "bottom-right": "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
  }

  const cursors: Record<typeof handle, string> = {
    "top-left": "nwse-resize",
    "top-right": "nesw-resize",
    "bottom-left": "nesw-resize",
    "bottom-right": "nwse-resize",
  }

  return (
    <div
      className={`absolute h-4 w-4 rounded-full border-2 border-black bg-white ${positions[handle]}`}
      style={{ cursor: cursors[handle] }}
      onPointerDown={onPointerDown}
    />
  )
}

function calculateResize(
  state: DragState,
  dx: number,
  dy: number,
): { position: CanvasPoint; size: CanvasSize } {
  let { width, height } = state.startSize
  let { x, y } = state.startPosition

  const applyWidth = (next: number, anchorRight: boolean) => {
    const clamped = Math.max(MIN_SIZE, Math.round(next))
    if (anchorRight) {
      x = state.startPosition.x + (state.startSize.width - clamped)
    }
    width = clamped
  }

  const applyHeight = (next: number, anchorBottom: boolean) => {
    const clamped = Math.max(MIN_SIZE, Math.round(next))
    if (anchorBottom) {
      y = state.startPosition.y + (state.startSize.height - clamped)
    }
    height = clamped
  }

  switch (state.handle) {
    case "top-left":
      applyWidth(state.startSize.width - dx, true)
      applyHeight(state.startSize.height - dy, true)
      break
    case "top-right":
      applyWidth(state.startSize.width + dx, false)
      applyHeight(state.startSize.height - dy, true)
      break
    case "bottom-left":
      applyWidth(state.startSize.width - dx, true)
      applyHeight(state.startSize.height + dy, false)
      break
    case "bottom-right":
      applyWidth(state.startSize.width + dx, false)
      applyHeight(state.startSize.height + dy, false)
      break
    default:
      break
  }

  return {
    position: { x: Math.max(0, x), y: Math.max(0, y) },
    size: { width, height },
  }
}
