import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { SerializedCanvasImage, SerializedCanvasRecord } from "@/lib/canvas/types"
import {
  createCanvasBox,
  deleteCanvasBox,
  generateCanvasBoxImage,
  updateCanvasBox,
} from "@/lib/canvas/client"
import type { CanvasBox } from "./types"
import { CanvasBoard } from "./CanvasBoard"
import { CanvasToolbar } from "./CanvasToolbar"
import { PromptPanel } from "./PromptPanel"

export type CanvasExperienceProps = {
  initialCanvas: SerializedCanvasRecord
  initialImages: SerializedCanvasImage[]
}

const toBox = (image: SerializedCanvasImage): CanvasBox => ({
  ...image,
  isGenerating: false,
})

export const CanvasExperience = ({ initialCanvas, initialImages }: CanvasExperienceProps) => {
  const [canvas] = useState(initialCanvas)
  const [boxes, setBoxes] = useState<CanvasBox[]>(() => initialImages.map(toBox))
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    initialImages[0]?.id ?? null,
  )
  const [isPending, startTransition] = useTransition()
  const promptSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId],
  )

  useEffect(() => {
    if (!selectedBoxId && boxes[0]) {
      setSelectedBoxId(boxes[0].id)
    }
  }, [boxes, selectedBoxId])

  useEffect(() => {
    return () => {
      if (promptSaveRef.current) {
        clearTimeout(promptSaveRef.current)
      }
    }
  }, [])

  const updateBoxState = useCallback(
    (id: string, updater: (box: CanvasBox) => CanvasBox) => {
      setBoxes((prev) => prev.map((box) => (box.id === id ? updater(box) : box)))
    },
    [],
  )

  const handleRectChange = useCallback(
    (id: string, rect: { position: CanvasBox["position"]; size: { width: number; height: number } }) => {
      updateBoxState(id, (box) => ({
        ...box,
        position: rect.position,
        width: rect.size.width,
        height: rect.size.height,
      }))
    },
    [updateBoxState],
  )

  const handleRectCommit = useCallback(
    (id: string, rect: { position: CanvasBox["position"]; size: { width: number; height: number } }) => {
      startTransition(async () => {
        try {
          const image = await updateCanvasBox(id, {
            position: rect.position,
            size: rect.size,
          })
          updateBoxState(id, () => toBox(image))
        } catch (error) {
          setBanner("Failed to save position")
        }
      })
    },
    [startTransition, updateBoxState],
  )

  const handleAddBox = useCallback(() => {
    const reference = boxes[boxes.length - 1]
    const fallbackPosition = reference
      ? { x: reference.position.x + reference.width + 48, y: reference.position.y }
      : { x: 0, y: 0 }

    startTransition(async () => {
      try {
        const image = await createCanvasBox({
          canvasId: canvas.id,
          position: fallbackPosition,
        })
        const newBox = toBox(image)
        setBoxes((prev) => [...prev, newBox])
        setSelectedBoxId(newBox.id)
      } catch (error) {
        setBanner("Failed to add box")
      }
    })
  }, [boxes, canvas.id, startTransition])

  const handleDuplicateBox = useCallback(() => {
    if (!selectedBox) return
    const position = {
      x: selectedBox.position.x + 40,
      y: selectedBox.position.y + 40,
    }

    startTransition(async () => {
      try {
        const image = await createCanvasBox({
          canvasId: canvas.id,
          name: `${selectedBox.name} Copy`,
          prompt: selectedBox.prompt,
          position,
          size: { width: selectedBox.width, height: selectedBox.height },
          modelId: selectedBox.modelId,
          styleId: selectedBox.styleId,
        })
        const newBox = toBox(image)
        setBoxes((prev) => [...prev, newBox])
        setSelectedBoxId(newBox.id)
      } catch (error) {
        setBanner("Failed to duplicate box")
      }
    })
  }, [canvas.id, selectedBox, startTransition])

  const handleDeleteBox = useCallback(() => {
    if (!selectedBoxId) return
    if (boxes.length === 1) {
      setBanner("Keep at least one box on the canvas.")
      return
    }

    startTransition(async () => {
      try {
        await deleteCanvasBox(selectedBoxId)
        setBoxes((prev) => {
          const filtered = prev.filter((box) => box.id !== selectedBoxId)
          setSelectedBoxId(filtered[0]?.id ?? null)
          return filtered
        })
      } catch (error) {
        setBanner("Failed to delete box")
      }
    })
  }, [boxes.length, selectedBoxId, startTransition])

  const schedulePromptSave = useCallback(
    (id: string, prompt: string) => {
      if (promptSaveRef.current) {
        clearTimeout(promptSaveRef.current)
      }

      promptSaveRef.current = setTimeout(() => {
        startTransition(async () => {
          try {
            const image = await updateCanvasBox(id, { prompt })
            updateBoxState(id, () => toBox(image))
          } catch (error) {
            setBanner("Failed to save prompt")
          }
        })
      }, 600)
    },
    [startTransition, updateBoxState],
  )

  const handlePromptChange = useCallback(
    (prompt: string) => {
      if (!selectedBoxId) return
      updateBoxState(selectedBoxId, (box) => ({ ...box, prompt }))
      schedulePromptSave(selectedBoxId, prompt)
    },
    [selectedBoxId, schedulePromptSave, updateBoxState],
  )

  const handleModelChange = useCallback(
    (modelId: string) => {
      if (!selectedBoxId) return
      updateBoxState(selectedBoxId, (box) => ({ ...box, modelId }))
      startTransition(async () => {
        try {
          await updateCanvasBox(selectedBoxId, { modelId })
        } catch (error) {
          setBanner("Failed to update model")
        }
      })
    },
    [selectedBoxId, startTransition, updateBoxState],
  )

  const handleStyleChange = useCallback(
    (styleId: string) => {
      if (!selectedBoxId) return
      updateBoxState(selectedBoxId, (box) => ({ ...box, styleId }))
      startTransition(async () => {
        try {
          await updateCanvasBox(selectedBoxId, { styleId })
        } catch (error) {
          setBanner("Failed to update style")
        }
      })
    },
    [selectedBoxId, startTransition, updateBoxState],
  )

  const handleGenerate = useCallback(() => {
    if (!selectedBoxId) {
      setBanner("Select a box before generating.")
      return
    }

    const target = boxes.find((box) => box.id === selectedBoxId)
    if (!target) return

    if (!target.prompt.trim()) {
      setBanner("Add a prompt first.")
      return
    }

    updateBoxState(selectedBoxId, (box) => ({ ...box, isGenerating: true }))

    startTransition(async () => {
      try {
        const image = await generateCanvasBoxImage({
          imageId: selectedBoxId,
          prompt: target.prompt,
          modelId: target.modelId,
        })
        setBoxes((prev) =>
          prev.map((box) =>
            box.id === selectedBoxId ? { ...toBox(image), isGenerating: false } : box,
          ),
        )
      } catch (error) {
        updateBoxState(selectedBoxId, (box) => ({ ...box, isGenerating: false }))
        setBanner("Image generation failed")
      }
    })
  }, [boxes, selectedBoxId, startTransition, updateBoxState])

  const toolbarDisabled = isPending

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="relative flex-1">
        <CanvasBoard
          boxes={boxes}
          className="h-full"
          onRectChange={handleRectChange}
          onRectCommit={handleRectCommit}
          onSelect={setSelectedBoxId}
          selectedBoxId={selectedBoxId}
        />
        <div className="pointer-events-none absolute left-6 top-6">
          <CanvasToolbar
            canDelete={boxes.length > 1 && Boolean(selectedBoxId)}
            canDuplicate={Boolean(selectedBoxId)}
            disabled={toolbarDisabled}
            onAdd={handleAddBox}
            onDelete={handleDeleteBox}
            onDuplicate={handleDuplicateBox}
          />
        </div>
      </div>
      <PromptPanel
        box={selectedBox}
        defaultModel={canvas.defaultModel}
        isGenerating={selectedBox?.isGenerating}
        onGenerate={handleGenerate}
        onModelChange={handleModelChange}
        onPromptChange={handlePromptChange}
        onStyleChange={handleStyleChange}
      />
    </div>
  )
}
