import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import type { CanvasRect } from "../config"

type CanvasBox = {
  id: string
  name: string
  prompt: string
  rect: CanvasRect
  imageUrl?: string
  description?: string
  model: "gemini" | "dall-e-3" | "nano-banana"
  styleId?: string
  branchParentId?: string | null
}

type OnboardingStep =
  | "welcome"
  | "add-box"
  | "select-box"
  | "enter-prompt"
  | "generate-image"
  | "resize-box"
  | "complete"

type CanvasStoreValue = {
  boxes: CanvasBox[]
  selectedBoxId: string | null
  setBoxes: (next: CanvasBox[] | ((prev: CanvasBox[]) => CanvasBox[])) => void
  addBox: (
    box?: Partial<Omit<CanvasBox, "rect">> & {
      rect?: Partial<CanvasRect>
    },
    options?: {
      select?: boolean
    }
  ) => CanvasBox | null
  updateBoxRect: (id: string, updater: (rect: CanvasRect) => CanvasRect) => void
  updateBoxData: (id: string, updater: (box: CanvasBox) => CanvasBox) => void
  deleteBox: (id: string) => void
  setSelectedBoxId: (id: string | null) => void
  reset: (
    boxes: Array<
      Partial<Omit<CanvasBox, "rect">> & {
        name?: string
        rect?: Partial<CanvasRect>
        imageUrl?: string
        description?: string
        model?: "gemini" | "dall-e-3" | "nano-banana"
        styleId?: string
      }
    >
  ) => void
  // Onboarding state
  onboardingStep: OnboardingStep | null
  setOnboardingStep: (step: OnboardingStep | null) => void
  startOnboarding: () => void
  completeOnboarding: () => void
}

const CanvasStoreContext = createContext<CanvasStoreValue | undefined>(
  undefined
)

const defaultRect: CanvasRect = {
  x: 0,
  y: 0,
  width: 256,
  height: 256,
}

const BOX_GAP = 24
const BRANCH_VERTICAL_GAP = 32

let idCounter = 0
const newId = () => `canvas-box-${++idCounter}`

const normaliseRect = (rect: CanvasRect): CanvasRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
})

type CreateBoxInput = {
  id?: string
  name: string
  prompt?: string
  rect?: CanvasRect
  imageUrl?: string
  description?: string
  model?: "gemini" | "dall-e-3" | "nano-banana"
  styleId?: string
  branchParentId?: string | null
}

const createBox = ({
  id,
  name,
  prompt = "",
  rect = defaultRect,
  imageUrl,
  description,
  model = "gemini",
  styleId = "default",
  branchParentId,
}: CreateBoxInput): CanvasBox => ({
  id: id ?? newId(),
  name,
  prompt,
  rect: normaliseRect(rect),
  imageUrl,
  description,
  model,
  styleId,
  branchParentId: branchParentId ?? null,
})

export function CanvasProvider({ children }: PropsWithChildren) {
  const [boxes, setBoxesState] = useState<CanvasBox[]>([])
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(
    null
  )

  const setBoxes = useCallback(
    (next: CanvasBox[] | ((prev: CanvasBox[]) => CanvasBox[])) => {
      setBoxesState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: CanvasBox[]) => CanvasBox[])(prev)
            : next
        return resolved.map((box) => ({
          ...box,
          rect: normaliseRect(box.rect),
          model: box.model ?? "gemini",
          styleId: box.styleId ?? "default",
          branchParentId: box.branchParentId ?? null,
        }))
      })
    },
    []
  )

  const addBox = useCallback(
    (
      overrides?: Partial<Omit<CanvasBox, "id" | "name" | "rect">> & {
        rect?: Partial<CanvasRect>
      },
      options?: {
        select?: boolean
      }
    ) => {
      let created: CanvasBox | null = null
      setBoxesState((prev) => {
        const name = overrides?.name ?? `Box ${prev.length + 1}`
        const last = prev[prev.length - 1] ?? null
        const branchParent = overrides?.branchParentId
          ? prev.find((box) => box.id === overrides.branchParentId)
          : null
        const branchSiblingCount = branchParent
          ? prev.filter((box) => box.branchParentId === branchParent.id).length
          : 0
        const rect: CanvasRect = {
          x:
            overrides?.rect?.x ??
            (branchParent
              ? branchParent.rect.x
              : last
              ? last.rect.x + last.rect.width + BOX_GAP
              : 0),
          y:
            overrides?.rect?.y ??
            (branchParent
              ? branchParent.rect.y +
                branchParent.rect.height +
                BRANCH_VERTICAL_GAP +
                branchSiblingCount *
                  (branchParent.rect.height + BRANCH_VERTICAL_GAP)
              : last
              ? last.rect.y
              : 0),
          width:
            overrides?.rect?.width ??
            (branchParent ? branchParent.rect.width : defaultRect.width),
          height:
            overrides?.rect?.height ??
            (branchParent ? branchParent.rect.height : defaultRect.height),
        }
        created = createBox({
          id: overrides?.id,
          name,
          prompt: overrides?.prompt ?? "",
          rect,
          imageUrl: overrides?.imageUrl,
          description: overrides?.description,
          model: overrides?.model ?? "gemini",
          styleId: overrides?.styleId ?? "default",
          branchParentId: overrides?.branchParentId ?? null,
        })
        return [...prev, created]
      })
      const shouldSelect = options?.select ?? true
      if (created && shouldSelect) {
        setSelectedBoxId(created.id)
      }
      return created
    },
    []
  )

  const updateBoxRect = useCallback(
    (id: string, updater: (rect: CanvasRect) => CanvasRect) => {
      setBoxesState((prev) =>
        prev.map((box) =>
          box.id === id
            ? {
                ...box,
                rect: normaliseRect(updater(box.rect)),
              }
            : box
        )
      )
    },
    []
  )

  const updateBoxData = useCallback(
    (id: string, updater: (box: CanvasBox) => CanvasBox) => {
      setBoxesState((prev) =>
        prev.map((box) => {
          if (box.id !== id) {
            return box
          }
          const updated = updater(box)
          return {
            ...updated,
            model: updated.model ?? "gemini",
            rect: normaliseRect(updated.rect),
            styleId: updated.styleId ?? box.styleId ?? "default",
            branchParentId:
              updated.branchParentId ?? box.branchParentId ?? null,
          }
        })
      )
    },
    []
  )

  const deleteBox = useCallback((id: string) => {
    setBoxesState((prev) => {
      if (prev.length <= 1) {
        return prev
      }
      const next = prev.filter((box) => box.id !== id)
      if (next.length > 0) {
        setSelectedBoxId(next[next.length - 1]?.id ?? null)
      } else {
        setSelectedBoxId(null)
      }
      return next
    })
  }, [])

  const reset = useCallback(
    (
      initial: Array<
        Partial<Omit<CanvasBox, "id" | "name" | "rect">> & {
          name?: string
          rect?: Partial<CanvasRect>
          imageUrl?: string
        }
      >
    ) => {
      let counter = 0
      let cursorX = 0
      const next = initial.map((item) => {
        counter += 1
        const rect: CanvasRect = {
          x: item.rect?.x ?? cursorX,
          y: item.rect?.y ?? 0,
          width: item.rect?.width ?? defaultRect.width,
          height: item.rect?.height ?? defaultRect.height,
        }
        const box = createBox({
          id: item.id,
          name: item.name ?? `Box ${counter}`,
          prompt: item.prompt ?? "",
          rect,
          imageUrl: item.imageUrl,
          description: item.description,
          model: item.model ?? "gemini",
          styleId: item.styleId ?? "default",
          branchParentId: item.branchParentId ?? null,
        })
        cursorX = box.rect.x + box.rect.width + BOX_GAP
        return box
      })
      setBoxes(next)
      setSelectedBoxId(next[0]?.id ?? null)
    },
    [setBoxes]
  )

  const startOnboarding = useCallback(() => {
    setOnboardingStep("welcome")
  }, [])

  const completeOnboarding = useCallback(() => {
    setOnboardingStep(null)
  }, [])

  const value = useMemo<CanvasStoreValue>(
    () => ({
      boxes,
      selectedBoxId,
      setBoxes,
      addBox,
      updateBoxRect,
      updateBoxData,
      deleteBox,
      setSelectedBoxId,
      reset,
      onboardingStep,
      setOnboardingStep,
      startOnboarding,
      completeOnboarding,
    }),
    [
      boxes,
      selectedBoxId,
      setBoxes,
      addBox,
      updateBoxRect,
      updateBoxData,
      deleteBox,
      reset,
      onboardingStep,
      setOnboardingStep,
      startOnboarding,
      completeOnboarding,
    ]
  )

  return (
    <CanvasStoreContext.Provider value={value}>
      {children}
    </CanvasStoreContext.Provider>
  )
}

export function useCanvasStore(): CanvasStoreValue {
  const ctx = useContext(CanvasStoreContext)
  if (!ctx) {
    throw new Error("useCanvasStore must be used within a CanvasProvider")
  }
  return ctx
}

export type { CanvasBox }
