import { useMemo } from "react"
import { CheckIcon } from "lucide-react"

import { useCanvasStore } from "../store/canvasStore"

export type ModelId = "gemini" | "dall-e-3" | "nano-banana"

export const MODEL_OPTIONS: Array<{
  id: ModelId
  label: string
  description: string
  disabled?: boolean
  badge?: string
}> = [
  {
    id: "gemini",
    label: "Gemini 2.5 Flash Image Preview",
    description:
      "Google's multimodal model for high-quality image + text generations.",
  },
  {
    id: "dall-e-3",
    label: "DALL·E 3",
    description:
      "OpenAI's flagship model for photorealistic, stylistic image generation.",
  },
  {
    id: "nano-banana",
    label: "Nano Banana",
    description:
      "Fast experimental model for playful concepts and draft visuals.",
    disabled: true,
    badge: "Coming soon",
  },
]

export default function Models({
  onClose,
  onSelectModel,
}: {
  onClose: () => void
  onSelectModel?: (modelId: ModelId) => void
}) {
  const { boxes, selectedBoxId, updateBoxData } = useCanvasStore()
  const active = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId]
  )

  if (!active) {
    return (
      <div className="text-sm text-white/60">
        Select a box to choose its generation model.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-white">Choose a model</div>
      <div className="space-y-2">
        {MODEL_OPTIONS.map((option) => {
          const isActive = option.id === active.model
          const disabled = option.disabled
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return
                }
                if (option.id !== active.model) {
                  if (onSelectModel) {
                    onSelectModel(option.id)
                  } else {
                    updateBoxData(active.id, (box) => ({
                      ...box,
                      model: option.id,
                    }))
                  }
                }
                onClose()
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                disabled
                  ? "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
                  : isActive
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-white/60">
                    {option.description}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {option.badge ? (
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                      {option.badge}
                    </span>
                  ) : null}
                  {isActive ? (
                    <CheckIcon className="h-4 w-4 text-white" />
                  ) : null}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
