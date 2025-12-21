import { CheckIcon } from "lucide-react"
import { useMemo } from "react"

import { useCanvasStore } from "../store/canvasStore"
import { STYLE_PRESETS } from "../styles-presets"

export default function Styles({
  onClose,
  onSelectStyle,
  activeStyleId,
}: {
  onClose: () => void
  onSelectStyle: (styleId: string) => void
  activeStyleId: string
}) {
  const { boxes, selectedBoxId } = useCanvasStore()
  const active = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId]
  )

  if (!active) {
    return (
      <div className="text-sm text-white/60">
        Select a box to choose a style.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-white">Choose a style</div>
      <div className="space-y-2">
        {STYLE_PRESETS.map((preset) => {
          const currentId = activeStyleId ?? active.styleId ?? "default"
          const isActive = currentId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onSelectStyle(preset.id)
                onClose()
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div className="text-xs text-white/60">
                    {preset.description}
                  </div>
                </div>
                {isActive ? <CheckIcon className="h-4 w-4 text-white" /> : null}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {preset.prompt}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
