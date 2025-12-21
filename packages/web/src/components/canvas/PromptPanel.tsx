import { useEffect, useState } from "react"
import type { CanvasBox } from "./types"

const STYLE_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "cinematic", label: "Cinematic" },
  { id: "illustration", label: "Illustration" },
]

type PromptPanelProps = {
  box: CanvasBox | null
  defaultModel: string
  isGenerating?: boolean
  onPromptChange: (prompt: string) => void
  onModelChange: (modelId: string) => void
  onStyleChange: (styleId: string) => void
  onGenerate: () => void
}

export const PromptPanel = ({
  box,
  defaultModel,
  isGenerating,
  onPromptChange,
  onModelChange,
  onStyleChange,
  onGenerate,
}: PromptPanelProps) => {
  const [localPrompt, setLocalPrompt] = useState(box?.prompt ?? "")

  useEffect(() => {
    setLocalPrompt(box?.prompt ?? "")
  }, [box?.id, box?.prompt])

  if (!box) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-black/40 p-6 text-center text-sm text-white/60 backdrop-blur">
        Select a canvas box to edit its prompt and generate an image.
      </div>
    )
  }

  const handlePromptChange = (value: string) => {
    setLocalPrompt(value)
    onPromptChange(value)
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-white/10 bg-black/40 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.3em] text-white/50" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-white focus:border-white/60 focus:outline-none"
          placeholder="Describe what you want Gemini to draw..."
          value={localPrompt}
          onChange={(event) => handlePromptChange(event.target.value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-white/50" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-white focus:border-white/60 focus:outline-none"
            value={box.modelId || defaultModel}
            onChange={(event) => onModelChange(event.target.value)}
          >
            <option value="gemini-2.0-flash-exp-image-generation">
              Gemini 2.0 Flash (Image)
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-white/50" htmlFor="style">
            Style
          </label>
          <select
            id="style"
            className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-white focus:border-white/60 focus:outline-none"
            value={box.styleId ?? "default"}
            onChange={(event) => onStyleChange(event.target.value)}
          >
            {STYLE_OPTIONS.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <button
            type="button"
            className="h-12 rounded-full bg-white text-xs font-semibold uppercase tracking-[0.3em] text-black shadow-[0_15px_40px_rgba(255,255,255,0.35)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/30"
            disabled={isGenerating || !localPrompt.trim()}
            onClick={onGenerate}
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  )
}
