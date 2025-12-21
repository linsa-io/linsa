import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import Canvas from "./components/Canvas"
import Overlay from "./components/Overlay"
import Onboarding from "./components/Onboarding"
import {
  CanvasProvider,
  useCanvasStore,
  type CanvasBox,
} from "./store/canvasStore"
import type {
  SerializedCanvasImage,
  SerializedCanvasRecord,
} from "@/lib/canvas/types"
import {
  createCanvasBox,
  deleteCanvasBox,
  generateCanvasBoxImage,
  updateCanvasBox,
} from "@/lib/canvas/client"
import type { CanvasRect } from "./config"
import { motion } from "framer-motion"

const TOKEN_COST = 1
const DEFAULT_TOKEN_BALANCE = { tokens: 999, premiumTokens: 999 }

type BladeCanvasExperienceProps = {
  initialCanvas: SerializedCanvasRecord
  initialImages: SerializedCanvasImage[]
}

const getImageDataUrl = (image: SerializedCanvasImage) => {
  if (image.imageUrl) {
    return image.imageUrl
  }
  if (image.imageData) {
    const mime =
      typeof image.metadata?.mimeType === "string" ? image.metadata.mimeType : "image/png"
    return `data:${mime};base64,${image.imageData}`
  }
  return undefined
}

const uiModelFromProvider = (
  modelId: string | null | undefined,
): CanvasBox["model"] => {
  if (!modelId) {
    return "gemini"
  }
  if (modelId.includes("gpt-image") || modelId.includes("dall")) {
    return "dall-e-3"
  }
  if (modelId.includes("nano-banana")) {
    return "nano-banana"
  }
  return "gemini"
}

const GEMINI_MODEL = "gemini-2.5-flash-image-preview"

const providerModelFromUi = (model: CanvasBox["model"]) => {
  switch (model) {
    case "dall-e-3":
      return "gpt-image-1"
    case "nano-banana":
      return "nano-banana"
    default:
      return GEMINI_MODEL
  }
}

const mapImageToBoxInput = (image: SerializedCanvasImage): CanvasBox => ({
  id: image.id,
  name: image.name,
  prompt: image.prompt ?? "",
  rect: {
    x: image.position?.x ?? 0,
    y: image.position?.y ?? 0,
    width: image.width,
    height: image.height,
  },
  imageUrl: getImageDataUrl(image),
  description:
    typeof image.metadata?.description === "string" ? image.metadata.description : undefined,
  model: uiModelFromProvider(image.modelId),
  styleId: image.styleId ?? "default",
  branchParentId: image.branchParentId ?? null,
})

const rectToPosition = (rect: CanvasRect) => ({ x: rect.x, y: rect.y })
const rectToSize = (rect: CanvasRect) => ({ width: rect.width, height: rect.height })

export function BladeCanvasExperience({
  initialCanvas,
  initialImages,
}: BladeCanvasExperienceProps) {
  return (
    <CanvasProvider>
      <BladeCanvasExperienceContent
        initialCanvas={initialCanvas}
        initialImages={initialImages}
      />
    </CanvasProvider>
  )
}

function BladeCanvasExperienceContent({
  initialCanvas,
  initialImages,
}: BladeCanvasExperienceProps) {
  const canvasId = initialCanvas.id
  const {
    boxes,
    addBox,
    updateBoxData,
    deleteBox,
    setSelectedBoxId,
    selectedBoxId,
    reset,
    startOnboarding,
  } = useCanvasStore()

  const [promptValue, setPromptValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [generatingBoxIds, setGeneratingBoxIds] = useState<string[]>([])
  const [promptContextLabel, setPromptContextLabel] = useState<string | null>(null)
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null)
  const promptSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  const activeBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId],
  )

  const editingBox = useMemo(
    () => (editingBoxId ? boxes.find((box) => box.id === editingBoxId) ?? null : null),
    [boxes, editingBoxId],
  )

  useEffect(() => {
    if (initializedRef.current) {
      return
    }
    reset(initialImages.map(mapImageToBoxInput))
    initializedRef.current = true
  }, [initialImages, reset])

  useEffect(() => {
    if (!activeBox) {
      setPromptValue("")
      return
    }
    setPromptValue((prev) => (prev === activeBox.prompt ? prev : activeBox.prompt))
  }, [activeBox?.id, activeBox?.prompt])

  useEffect(() => {
    if (boxes.length === 0) {
      startOnboarding()
    }
  }, [boxes.length, startOnboarding])

  useEffect(() => {
    if (!activeBox) {
      setPromptContextLabel(null)
      return
    }
    if (activeBox.branchParentId) {
      const boxIndex = boxes.findIndex((box) => box.id === activeBox.id) + 1
      const parentIndex =
        boxes.findIndex((box) => box.id === activeBox.branchParentId) + 1
      setPromptContextLabel(
        `Box ${boxIndex} Branch of Box ${parentIndex > 0 ? parentIndex : "?"}`,
      )
    } else if (activeBox.name) {
      setPromptContextLabel(activeBox.name)
    } else {
      const boxIndex = boxes.findIndex((box) => box.id === activeBox.id) + 1
      setPromptContextLabel(boxIndex ? `Box ${boxIndex}` : null)
    }
  }, [activeBox, boxes])

  useEffect(() => {
    return () => {
      if (promptSaveRef.current) {
        clearTimeout(promptSaveRef.current)
      }
    }
  }, [])

  const schedulePromptSave = useCallback((boxId: string, prompt: string) => {
    if (promptSaveRef.current) {
      clearTimeout(promptSaveRef.current)
    }
    promptSaveRef.current = setTimeout(() => {
      updateCanvasBox(boxId, { prompt }).catch((err) => {
        console.error("[canvas] failed to persist prompt", err)
        setError("Failed to save prompt")
      })
    }, 600)
  }, [])

  const syncBoxWithImage = useCallback(
    (localId: string, image: SerializedCanvasImage) => {
      const mapped = mapImageToBoxInput(image)
      updateBoxData(localId, () => mapped as CanvasBox)
      if (localId !== mapped.id) {
        setSelectedBoxId((prev) => (prev === localId ? mapped.id : prev))
        setGeneratingBoxIds((prev) => prev.map((id) => (id === localId ? mapped.id : id)))
      }
      return mapped.id
    },
    [setSelectedBoxId, updateBoxData],
  )

  const persistNewBox = useCallback(
    async (box: CanvasBox) => {
      const image = await createCanvasBox({
        canvasId,
        name: box.name,
        prompt: box.prompt,
        position: rectToPosition(box.rect),
        size: rectToSize(box.rect),
        modelId: providerModelFromUi(box.model),
        styleId: box.styleId ?? "default",
        branchParentId: box.branchParentId ?? null,
      })
      return syncBoxWithImage(box.id, image)
    },
    [canvasId, syncBoxWithImage],
  )

  const handlePromptValueChange = useCallback(
    (value: string) => {
      setPromptValue(value)
      if (!selectedBoxId) {
        return
      }
      updateBoxData(selectedBoxId, (box) => ({
        ...box,
        prompt: value,
      }))
      schedulePromptSave(selectedBoxId, value)
    },
    [schedulePromptSave, selectedBoxId, updateBoxData],
  )

  const handleSelectStyle = useCallback(
    async (styleId: string) => {
      if (!selectedBoxId) return
      updateBoxData(selectedBoxId, (box) => ({ ...box, styleId }))
      try {
        await updateCanvasBox(selectedBoxId, { styleId })
      } catch (err) {
        console.error("[canvas] failed to update style", err)
        setError("Failed to update style")
      }
    },
    [selectedBoxId, updateBoxData],
  )

  const handleModelChange = useCallback(
    async (modelId: CanvasBox["model"], boxId?: string) => {
      const targetId = boxId ?? selectedBoxId
      if (!targetId) return
      updateBoxData(targetId, (box) => ({ ...box, model: modelId }))
      try {
        await updateCanvasBox(targetId, {
          modelId: providerModelFromUi(modelId),
        })
      } catch (err) {
        console.error("[canvas] failed to update model", err)
        setError("Failed to update model")
      }
    },
    [selectedBoxId, updateBoxData],
  )

  const handleRectCommit = useCallback(
    (boxId: string, rect: CanvasRect) => {
      updateCanvasBox(boxId, {
        position: rectToPosition(rect),
        size: rectToSize(rect),
      }).catch((err) => {
        console.error("[canvas] failed to persist rect", err)
        setError("Failed to save box position")
      })
    },
    [],
  )

  const handleEditPromptChange = useCallback(
    (boxId: string, value: string) => {
      updateBoxData(boxId, (box) => ({
        ...box,
        prompt: value,
      }))
      schedulePromptSave(boxId, value)
    },
    [schedulePromptSave, updateBoxData],
  )

  const handleEditSizeChange = useCallback(
    (boxId: string, dimension: "width" | "height", value: number) => {
      if (!Number.isFinite(value) || value <= 0) {
        return
      }
      const target = boxes.find((box) => box.id === boxId)
      const width = dimension === "width" ? value : target?.rect.width ?? value
      const height = dimension === "height" ? value : target?.rect.height ?? value
      updateBoxData(boxId, (box) => ({
        ...box,
        rect: {
          ...box.rect,
          width,
          height,
        },
      }))
      updateCanvasBox(boxId, {
        size: { width, height },
      }).catch((err) => {
        console.error("[canvas] failed to update size", err)
        setError("Failed to update size")
      })
    },
    [boxes, updateBoxData],
  )

  const handleAddBox = useCallback(async () => {
    const created = addBox()
    if (!created) {
      return
    }
    try {
      const newId = await persistNewBox(created)
      setSelectedBoxId(newId)
      setError(null)
    } catch (err) {
      console.error("[canvas] failed to create box", err)
      deleteBox(created.id)
      setError("Failed to add box")
    }
  }, [addBox, deleteBox, persistNewBox, setSelectedBoxId])

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedBoxId) {
      return
    }
    if (boxes.length <= 1) {
      setError("Keep at least one box on the canvas.")
      return
    }
    try {
      await deleteCanvasBox(selectedBoxId)
      deleteBox(selectedBoxId)
      setGeneratingBoxIds((prev) => prev.filter((id) => id !== selectedBoxId))
      setError(null)
    } catch (err) {
      console.error("[canvas] failed to delete box", err)
      setError("Failed to delete box")
    }
  }, [boxes.length, deleteBox, selectedBoxId])

  const handleBranchFrom = useCallback(
    async (box: CanvasBox) => {
      const parentIndex = boxes.findIndex((candidate) => candidate.id === box.id) + 1
      const branchName = `Box ${boxes.length + 1} Branch of Box ${parentIndex || "?"}`
      const created = addBox(
        {
          name: branchName,
          prompt: box.prompt,
          model: box.model,
          styleId: box.styleId,
          branchParentId: box.id,
        },
        { select: true },
      )
      if (!created) {
        return
      }
      setPromptValue(box.prompt)
      try {
        const newId = await persistNewBox(created)
        setSelectedBoxId(newId)
        setError(null)
      } catch (err) {
        console.error("[canvas] failed to branch box", err)
        deleteBox(created.id)
        setError("Unable to create a branch box")
      }
    },
    [addBox, boxes, deleteBox, persistNewBox, setSelectedBoxId],
  )

  const handleSubmitPrompt = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return false
      }

      let targetBoxId = selectedBoxId ?? null
      let targetBox = targetBoxId
        ? boxes.find((candidate) => candidate.id === targetBoxId) ?? null
        : null

      if (!targetBox || !targetBoxId) {
        const created = addBox({ prompt: trimmed }, { select: true })
        if (!created) {
          setError("Unable to create a box for this prompt")
          return false
        }
        try {
          targetBoxId = await persistNewBox(created)
          targetBox = { ...created, id: targetBoxId }
          setSelectedBoxId(targetBoxId)
        } catch (err) {
          console.error("[canvas] failed to create prompt box", err)
          deleteBox(created.id)
          setError("Unable to create a box for this prompt")
          return false
        }
      }

      const boxId = targetBoxId
      let effectivePrompt = trimmed
      if (targetBox?.branchParentId) {
        const parent = boxes.find((candidate) => candidate.id === targetBox.branchParentId)
        if (parent) {
          const parentPrompt = parent.prompt.trim()
          if (parentPrompt && !effectivePrompt.startsWith(parentPrompt)) {
            effectivePrompt = [parentPrompt, effectivePrompt]
              .map((item) => item.trim())
              .filter(Boolean)
              .join(" ")
          }
        }
      }

      setGeneratingBoxIds((prev) => (prev.includes(boxId) ? prev : [...prev, boxId]))
      setError(null)
      let currentId = boxId
      try {
        const image = await generateCanvasBoxImage({
          imageId: boxId,
          prompt: effectivePrompt,
          modelId: providerModelFromUi(targetBox!.model),
        })
        currentId = syncBoxWithImage(boxId, image)
        setPromptValue(effectivePrompt)
        return true
      } catch (err) {
        console.error("[canvas] generation failed", err)
        const message = err instanceof Error ? err.message : "Unable to generate image"
        setError(message)
        return false
      } finally {
        setGeneratingBoxIds((prev) => prev.filter((id) => id !== currentId))
      }
    },
    [addBox, boxes, deleteBox, persistNewBox, selectedBoxId, setSelectedBoxId, syncBoxWithImage],
  )

  const currentBoxName = activeBox?.name ?? null
  const isGenerating = selectedBoxId ? generatingBoxIds.includes(selectedBoxId) : false

  const handleOpenEdit = useCallback(
    (box: CanvasBox) => {
      setEditingBoxId(box.id)
      setSelectedBoxId(box.id)
    },
    [setSelectedBoxId],
  )

  const handleCloseEdit = useCallback(() => {
    setEditingBoxId(null)
  }, [])

  useEffect(() => {
    if (editingBoxId && !boxes.find((box) => box.id === editingBoxId)) {
      setEditingBoxId(null)
    }
  }, [boxes, editingBoxId])

  if (editingBox) {
    const imageUrl = editingBox.imageUrl
    return (
      <div className="flex h-screen w-full divide-x divide-white/10 overflow-hidden bg-neutral-950 text-white">
        <div className="relative flex-1 overflow-hidden">
          {imageUrl ? (
            <>
              <div
                className="absolute inset-0 scale-110 transform bg-cover bg-center blur-3xl opacity-50"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />
              <div className="relative z-10 flex h-full w-full items-center justify-center p-8">
                <motion.img
                  layoutId={`box-image-${editingBox.id}`}
                  src={imageUrl}
                  alt={editingBox.name}
                  className="max-h-full max-w-full rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
                />
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/60">
              No image generated yet.
            </div>
          )}
        </div>
        <div className="flex w-full max-w-md flex-col gap-6 bg-neutral-900/80 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-white/60">Editing</p>
              <h2 className="text-2xl font-semibold">{editingBox.name}</h2>
            </div>
            <button
              type="button"
              onClick={handleCloseEdit}
              className="rounded-full border border-white/20 px-4 py-1 text-sm text-white transition hover:border-white/50"
            >
              Done
            </button>
          </div>
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/60">Prompt</span>
              <textarea
                className="min-h-[150px] rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-white/40"
                value={editingBox.prompt}
                onChange={(event) => handleEditPromptChange(editingBox.id, event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-white/60">Width</span>
                <input
                  type="number"
                  min={64}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
                  value={Math.round(editingBox.rect.width)}
                  onChange={(event) => handleEditSizeChange(editingBox.id, "width", Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-white/60">Height</span>
                <input
                  type="number"
                  min={64}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
                  value={Math.round(editingBox.rect.height)}
                  onChange={(event) => handleEditSizeChange(editingBox.id, "height", Number(event.target.value))}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/60">Model</span>
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-white/40"
                value={editingBox.model}
                onChange={(event) => handleModelChange(event.target.value as CanvasBox["model"], editingBox.id)}
              >
                <option value="gemini">Gemini</option>
                <option value="dall-e-3">DALL·E 3</option>
                <option value="nano-banana" disabled>
                  Nano Banana (Coming soon)
                </option>
              </select>
            </label>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <span>Style</span>
              <span className="font-semibold">{editingBox.styleId}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 transition-colors duration-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-slate-100">
      <Canvas
        generatingBoxIds={generatingBoxIds}
        error={error}
        onBranchFrom={handleBranchFrom}
        onRectCommit={handleRectCommit}
        onEditBox={handleOpenEdit}
        editingBoxId={editingBoxId}
      />
      <Overlay
        value={promptValue}
        onValueChange={handlePromptValueChange}
        onSubmit={handleSubmitPrompt}
        isGenerating={isGenerating}
        error={error}
        contextLabel={promptContextLabel}
        onAddBox={handleAddBox}
        onDeleteSelected={handleDeleteSelected}
        onSelectStyle={handleSelectStyle}
        onSelectModel={handleModelChange}
        tokenBalance={DEFAULT_TOKEN_BALANCE}
        tokenCost={TOKEN_COST}
      />
      {currentBoxName ? (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 text-xs uppercase tracking-wide text-white/50">
          Selected: {currentBoxName}
        </div>
      ) : null}
      {/* <Onboarding /> */}
    </div>
  )
}
