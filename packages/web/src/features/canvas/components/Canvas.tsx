import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { AnimatePresence, motion } from "framer-motion"

import { CANVAS_CONFIG, type CanvasRect } from "../config"
import { useCanvasStore, type CanvasBox } from "../store/canvasStore"
import { GitBranch, Pencil, Trash2, Type } from "lucide-react"

const normaliseRect = (rect: CanvasRect): CanvasRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
})

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const MIN_VIEWPORT_SCALE = 0.4
const MAX_VIEWPORT_SCALE = 3
const ZOOM_SENSITIVITY = 0.0012

export type CanvasControls = {
  undo: () => void
  redo: () => void
  reset: () => void
  addBox: () => void
  deleteSelected: () => void
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
}

type CanvasProps = {
  generatingBoxIds?: string[]
  error?: string | null
  onControlsChange?: (controls: CanvasControls) => void
  onBranchFrom?: (box: CanvasBox) => void
  onRectCommit?: (boxId: string, rect: CanvasRect) => void
  onEditBox?: (box: CanvasBox) => void
  editingBoxId?: string | null
}

export default function Canvas({
  generatingBoxIds = [],
  error,
  onControlsChange,
  onBranchFrom,
  onRectCommit,
  onEditBox,
  editingBoxId = null,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const panStateRef = useRef<{
    pointerId: number
    startPointer: { x: number; y: number }
    startOffset: { x: number; y: number }
  } | null>(null)

  const {
    boxes,
    addBox,
    updateBoxRect,
    updateBoxData,
    deleteBox,
    selectedBoxId,
    setSelectedBoxId,
  } = useCanvasStore()

  const [viewport, setViewport] = useState<{
    x: number
    y: number
    scale: number
  }>(() => ({ x: 0, y: 0, scale: 1 }))
  const [contextMenuBoxId, setContextMenuBoxId] = useState<string | null>(null)

  const statusMessage = error
    ? error
    : "Enter a prompt below to create an image."

  const centerOnBox = useCallback((box: CanvasBox) => {
    const element = canvasRef.current
    if (!element) {
      return
    }
    const rect = element.getBoundingClientRect()
    setViewport((prev) => {
      const scale = prev.scale
      const boxCenterX = box.rect.x + box.rect.width / 2
      const boxCenterY = box.rect.y + box.rect.height / 2
      return {
        ...prev,
        x: rect.width / 2 - boxCenterX * scale,
        y: rect.height / 2 - boxCenterY * scale,
      }
    })
  }, [])

  const previousBoxesLengthRef = useRef<number>(boxes.length)

  useEffect(() => {
    const previousLength = previousBoxesLengthRef.current
    if (boxes.length === 0) {
      previousBoxesLengthRef.current = 0
      return
    }

    if (previousLength === 0) {
      centerOnBox(boxes[0])
    } else if (boxes.length > previousLength) {
      const last = boxes[boxes.length - 1]
      centerOnBox(last)
    }

    previousBoxesLengthRef.current = boxes.length
  }, [boxes, centerOnBox])

  const handleAdd = useCallback(() => {
    setContextMenuBoxId(null)
    addBox()
  }, [addBox])

  const handleDelete = useCallback(
    (targetId?: string) => {
      const id = targetId ?? selectedBoxId
      if (!id) {
        return
      }
      deleteBox(id)
      setContextMenuBoxId((prev) => (prev === id ? null : prev))
    },
    [deleteBox, selectedBoxId]
  )

  const handleContextMenuOpen = useCallback(
    (boxId: string) => {
      setContextMenuBoxId(boxId)
      setSelectedBoxId(boxId)
    },
    [setSelectedBoxId]
  )

  const handleContextMenuClose = useCallback(() => {
    setContextMenuBoxId(null)
  }, [])

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }

      const target = event.target as HTMLElement
      if (target.closest('[data-canvas-box="true"]')) {
        setContextMenuBoxId(null)
        return
      }

      event.preventDefault()
      const element = event.currentTarget
      panStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startOffset: { x: viewport.x, y: viewport.y },
      }
      setSelectedBoxId(null)
      setContextMenuBoxId(null)

      if (element.setPointerCapture) {
        try {
          element.setPointerCapture(event.pointerId)
        } catch {
          // ignore capture errors
        }
      }
    },
    [setSelectedBoxId, viewport.x, viewport.y]
  )

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current
      if (!state || event.pointerId !== state.pointerId) {
        return
      }
      event.preventDefault()
      const dx = event.clientX - state.startPointer.x
      const dy = event.clientY - state.startPointer.y
      setViewport((prev) => ({
        ...prev,
        x: state.startOffset.x + dx,
        y: state.startOffset.y + dy,
      }))
    },
    []
  )

  const handleCanvasPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current
      if (!state || event.pointerId !== state.pointerId) {
        return
      }
      panStateRef.current = null
      const element = event.currentTarget
      if (element.releasePointerCapture) {
        try {
          element.releasePointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }
    },
    []
  )

  const handleWheel = useCallback((event: WheelEvent) => {
    const element = canvasRef.current
    if (!element) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const rect = element.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    setViewport((prev) => {
      const scaleMultiplier = Math.exp(-event.deltaY * ZOOM_SENSITIVITY)
      const nextScale = clamp(
        prev.scale * scaleMultiplier,
        MIN_VIEWPORT_SCALE,
        MAX_VIEWPORT_SCALE
      )

      if (nextScale === prev.scale) {
        return prev
      }

      const worldX = (point.x - prev.x) / prev.scale
      const worldY = (point.y - prev.y) / prev.scale
      const nextX = point.x - worldX * nextScale
      const nextY = point.y - worldY * nextScale

      return {
        x: nextX,
        y: nextY,
        scale: nextScale,
      }
    })
  }, [])

  useEffect(() => {
    const element = canvasRef.current
    if (!element) {
      return
    }

    const handle = (event: WheelEvent) => {
      handleWheel(event)
    }

    element.addEventListener("wheel", handle, { passive: false })
    return () => {
      element.removeEventListener("wheel", handle)
    }
  }, [handleWheel])

  useEffect(() => {
    onControlsChange?.({
      undo: () => undefined,
      redo: () => undefined,
      reset: () => {
        const target =
          boxes.find((box) => box.id === selectedBoxId) ?? boxes[0] ?? null
        if (target) {
          centerOnBox(target)
        } else {
          setViewport((prev) => ({ ...prev, x: 0, y: 0 }))
        }
      },
      addBox: handleAdd,
      deleteSelected: handleDelete,
      canUndo: false,
      canRedo: false,
      hasSelection: Boolean(selectedBoxId),
    })
  }, [
    boxes,
    centerOnBox,
    handleAdd,
    handleDelete,
    onControlsChange,
    selectedBoxId,
  ])

  const handleDrag = useCallback(
    (id: string, start: CanvasRect, dx: number, dy: number) => {
      const nextRect = normaliseRect({
        ...start,
        x: start.x + dx / viewport.scale,
        y: start.y + dy / viewport.scale,
      })
      updateBoxRect(id, () => nextRect)
      return nextRect
    },
    [updateBoxRect, viewport.scale]
  )

  const handleResize = useCallback(
    (
      id: string,
      start: CanvasRect,
      handle: ResizeHandle,
      dx: number,
      dy: number
    ) => {
      const nextRect = calculateResizedRect(
        handle,
        start,
        dx / viewport.scale,
        dy / viewport.scale,
        {
          minWidth: CANVAS_CONFIG.MIN_WIDTH,
          minHeight: CANVAS_CONFIG.MIN_HEIGHT,
          maxWidth: CANVAS_CONFIG.MAX_PIXEL_WIDTH,
          maxHeight: CANVAS_CONFIG.MAX_PIXEL_HEIGHT,
        }
      )
      updateBoxRect(id, () => nextRect)
      return nextRect
    },
    [updateBoxRect, viewport.scale]
  )

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-hidden bg-white transition-colors duration-300 dark:bg-neutral-950"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerEnd}
      onPointerLeave={handleCanvasPointerEnd}
      onPointerCancel={handleCanvasPointerEnd}
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {boxes.map((box, index) => (
          <CanvasBox
            key={box.id}
            box={box}
            index={index}
            isSelected={box.id === selectedBoxId}
            defaultStatusMessage={statusMessage}
            isGenerating={generatingBoxIds.includes(box.id)}
            onSelect={() => setSelectedBoxId(box.id)}
            onDrag={handleDrag}
            onResize={handleResize}
            onInteractionStart={() => {
              const element = canvasRef.current
              const panState = panStateRef.current
              if (panState && element?.releasePointerCapture) {
                try {
                  element.releasePointerCapture(panState.pointerId)
                } catch {
                  // ignore
                }
              }
              panStateRef.current = null
            }}
            onInteractionEnd={(_, rect) => {
              if (onRectCommit) {
                onRectCommit(box.id, rect)
              }
            }}
            contextMenuOpen={contextMenuBoxId === box.id}
            onOpenContextMenu={handleContextMenuOpen}
            onCloseContextMenu={handleContextMenuClose}
            onDeleteBox={() => handleDelete(box.id)}
            onRenameBox={(newName) => {
              updateBoxData(box.id, (current) => ({
                ...current,
                name: newName,
              }))
            }}
            onBranchFrom={() => {
              if (onBranchFrom) {
                onBranchFrom(box)
              }
            }}
            onEditBox={() => onEditBox?.(box)}
            layoutActive={editingBoxId === box.id}
          />
        ))}
      </div>
      {boxes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/60">
          No boxes yet. Use the toolbar or prompt to add one.
        </div>
      ) : null}
    </div>
  )
}

type CanvasBoxProps = {
  box: CanvasBox
  index: number
  isSelected: boolean
  defaultStatusMessage: string
  isGenerating: boolean
  onSelect: () => void
  onDrag: (id: string, start: CanvasRect, dx: number, dy: number) => CanvasRect
  onResize: (
    id: string,
    start: CanvasRect,
    handle: ResizeHandle,
    dx: number,
    dy: number
  ) => CanvasRect
  onInteractionStart: () => void
  onInteractionEnd?: (type: "move" | "resize", rect: CanvasRect) => void
  contextMenuOpen: boolean
  onOpenContextMenu: (boxId: string) => void
  onCloseContextMenu: () => void
  onDeleteBox: () => void
  onRenameBox: (name: string) => void
  onBranchFrom: () => void
  onEditBox?: () => void
  layoutActive?: boolean
}

function CanvasBox({
  box,
  index,
  isSelected,
  defaultStatusMessage,
  isGenerating,
  onSelect,
  onDrag,
  onResize,
  onInteractionStart,
  onInteractionEnd,
  contextMenuOpen,
  onOpenContextMenu,
  onCloseContextMenu,
  onDeleteBox,
  onRenameBox,
  onBranchFrom,
  onEditBox,
  layoutActive = false,
}: CanvasBoxProps) {
  const [isHovering, setIsHovering] = useState(false)
  const pointerStateRef = useRef<{
    type: "move" | "resize"
    startPointer: { x: number; y: number }
    startRect: CanvasRect
    handle?: ResizeHandle
    latestRect?: CanvasRect
  } | null>(null)

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      event.stopPropagation()
      onSelect()
      onInteractionStart()
      onCloseContextMenu()
      pointerStateRef.current = {
        type: "move",
        startPointer: { x: event.clientX, y: event.clientY },
        startRect: { ...box.rect },
        latestRect: { ...box.rect },
      }
      const pointerId = event.pointerId
      const target = event.currentTarget
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(pointerId)
        } catch {
          // ignore capture errors
        }
      }

      const onMove = (ev: PointerEvent) => {
        const ctx = pointerStateRef.current
        if (!ctx || ctx.type !== "move") {
          return
        }
        const nextRect = onDrag(
          box.id,
          ctx.startRect,
          ev.clientX - ctx.startPointer.x,
          ev.clientY - ctx.startPointer.y
        )
        ctx.latestRect = nextRect
      }

      const finish = () => {
        const ctx = pointerStateRef.current
        pointerStateRef.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", finish)
        if (target.releasePointerCapture) {
          try {
            target.releasePointerCapture(pointerId)
          } catch {
            // ignore
          }
        }
        if (ctx && ctx.type === "move") {
          onInteractionEnd?.("move", ctx.latestRect ?? ctx.startRect)
        }
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", finish, { once: true })
      window.addEventListener("pointercancel", finish, { once: true })
    },
    [box.id, box.rect, onCloseContextMenu, onDrag, onInteractionEnd, onInteractionStart, onSelect]
  )

  const startResize = useCallback(
    (handle: ResizeHandle, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      event.stopPropagation()
      onSelect()
      onInteractionStart()
      onCloseContextMenu()
      pointerStateRef.current = {
        type: "resize",
        handle,
        startPointer: { x: event.clientX, y: event.clientY },
        startRect: { ...box.rect },
        latestRect: { ...box.rect },
      }
      const pointerId = event.pointerId
      const target = event.currentTarget
      if (target.setPointerCapture) {
        try {
          target.setPointerCapture(pointerId)
        } catch {
          // ignore
        }
      }

      const onMove = (ev: PointerEvent) => {
        const ctx = pointerStateRef.current
        if (!ctx || ctx.type !== "resize" || !ctx.handle) {
          return
        }
        const nextRect = onResize(
          box.id,
          ctx.startRect,
          ctx.handle,
          ev.clientX - ctx.startPointer.x,
          ev.clientY - ctx.startPointer.y
        )
        ctx.latestRect = nextRect
      }

      const finish = () => {
        const ctx = pointerStateRef.current
        pointerStateRef.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", finish)
        window.removeEventListener("pointercancel", finish)
        if (target.releasePointerCapture) {
          try {
            target.releasePointerCapture(pointerId)
          } catch {
            // ignore
          }
        }
        if (ctx && ctx.type === "resize") {
          onInteractionEnd?.("resize", ctx.latestRect ?? ctx.startRect)
        }
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", finish, { once: true })
      window.addEventListener("pointercancel", finish, { once: true })
    },
    [box.rect, box.id, onCloseContextMenu, onInteractionEnd, onInteractionStart, onResize, onSelect]
  )

  const showOutline = isSelected || isHovering
  const statusText = box.description ?? box.prompt ?? defaultStatusMessage

  return (
    <motion.div
      data-canvas-box="true"
      className="absolute"
      style={{
        width: box.rect.width,
        height: box.rect.height,
        left: box.rect.x,
        top: box.rect.y,
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={(event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault()
        onOpenContextMenu(box.id)
      }}
      onDoubleClick={() => onEditBox?.()}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
    >
      <div
        className={`relative w-full transition-all duration-300 h-full border canvas-box ${
          showOutline
            ? "border-indigo-400 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]"
            : "border-slate-200 dark:border-neutral-800"
        } bg-white text-slate-900 dark:bg-neutral-900/70 dark:text-white`}
      >
        <AnimatePresence>
          {contextMenuOpen ? (
            <motion.div

              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute -top-12 left-1/2 z-30 flex -translate-x-1/2 flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-lg dark:border-white/10 dark:bg-neutral-950/95 dark:text-white"
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                event.stopPropagation()
              }}
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    console.log("branching from", box)
                    onBranchFrom()
                    onCloseContextMenu()
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-900 transition hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Branch From
                </button>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onEditBox?.()
                    onCloseContextMenu()
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-900 transition hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextName = window.prompt("Rename box", box.name)
                    const trimmed = nextName?.trim()
                    if (!trimmed) {
                      return
                    }
                    onRenameBox(trimmed)
                    onCloseContextMenu()
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-900 transition hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <Type className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBox()
                    onCloseContextMenu()
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-500 transition hover:bg-red-50 dark:text-red-200 dark:hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div
          className={`absolute left-3 top-3 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium uppercase tracking-wide transition-all duration-300 ${
            isSelected
              ? "bg-indigo-500/90 text-white"
              : "bg-black/50 text-white/70"
          }`}
        >
          {box.branchParentId ? <GitBranch className="h-3 w-3" /> : null}
          <span>{box.name || `Box ${index + 1}`}</span>
        </div>
        {box.imageUrl ? (
          layoutActive ? (
            <motion.img
              layoutId={`box-image-${box.id}`}
              src={box.imageUrl}
              alt={box.name}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <img
              src={box.imageUrl}
              alt={box.name}
              className="w-full h-full object-cover pointer-events-none"
            />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4 text-white/70 text-sm">
            {statusText}
            {isGenerating ? (
              <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : null}
          </div>
        )}

        {showOutline ? (
          <div className="absolute bottom-2 right-3 text-[11px] text-white/80">
            {Math.round(box.rect.width)}×{Math.round(box.rect.height)}
          </div>
        ) : null}

        {showOutline ? (
          <>
            <EdgeHandle
              position="top"
              onPointerDown={(event) => startResize("n", event)}
            />
            <EdgeHandle
              position="bottom"
              onPointerDown={(event) => startResize("s", event)}
            />
            <EdgeHandle
              position="left"
              onPointerDown={(event) => startResize("w", event)}
            />
            <EdgeHandle
              position="right"
              onPointerDown={(event) => startResize("e", event)}
            />
            <CornerHandle
              position="top-left"
              onPointerDown={(event) => startResize("nw", event)}
            />
            <CornerHandle
              position="top-right"
              onPointerDown={(event) => startResize("ne", event)}
            />
            <CornerHandle
              position="bottom-left"
              onPointerDown={(event) => startResize("sw", event)}
            />
            <CornerHandle
              position="bottom-right"
              onPointerDown={(event) => startResize("se", event)}
            />
          </>
        ) : null}
        {isGenerating ? <div className="absolute inset-0 bg-black/30" /> : null}
      </div>
    </motion.div>
  )
}

type ResizeHandle = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"

type EdgeHandleProps = {
  position: "top" | "bottom" | "left" | "right"
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

function EdgeHandle({ position, onPointerDown }: EdgeHandleProps) {
  const isVertical = position === "top" || position === "bottom"
  const cursor = isVertical ? "ns-resize" : "ew-resize"
  const translateClass =
    position === "top"
      ? "-translate-y-1/2"
      : position === "bottom"
      ? "translate-y-1/2"
      : position === "left"
      ? "-translate-x-1/2"
      : "translate-x-1/2"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      onPointerDown={onPointerDown}
      className={`absolute ${translateClass} ${
        isVertical ? "left-0 right-0 h-3" : "top-0 bottom-0 w-3"
      } bg-transparent`}
      style={{ cursor }}
    />
  )
}

type CornerHandleProps = {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

function CornerHandle({ position, onPointerDown }: CornerHandleProps) {
  const cursor =
    position === "top-left" || position === "bottom-right"
      ? "nwse-resize"
      : "nesw-resize"

  const className =
    position === "top-left"
      ? "-top-1 -left-1"
      : position === "top-right"
      ? "-top-1 -right-1"
      : position === "bottom-left"
      ? "-bottom-1 -left-1"
      : "-bottom-1 -right-1"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      onPointerDown={onPointerDown}
      className={`absolute h-[10px] w-[10px] bg-indigo-400 ${className}`}
      style={{ cursor }}
    />
  )
}

function calculateResizedRect(
  handle: ResizeHandle,
  startRect: CanvasRect,
  dx: number,
  dy: number,
  limits: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
  }
): CanvasRect {
  let x = startRect.x
  let y = startRect.y
  let width = startRect.width
  let height = startRect.height

  if (handle.includes("e")) {
    width = clamp(width + dx, limits.minWidth, limits.maxWidth)
  }
  if (handle.includes("w")) {
    const updatedWidth = clamp(width - dx, limits.minWidth, limits.maxWidth)
    const delta = width - updatedWidth
    width = updatedWidth
    x += delta
  }
  if (handle.includes("s")) {
    height = clamp(height + dy, limits.minHeight, limits.maxHeight)
  }
  if (handle.includes("n")) {
    const updatedHeight = clamp(height - dy, limits.minHeight, limits.maxHeight)
    const delta = height - updatedHeight
    height = updatedHeight
    y += delta
  }

  return normaliseRect({ x, y, width, height })
}
