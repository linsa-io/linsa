import { ImageIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Prompt, { type PromptProps } from "./Prompt"
import { motion, AnimatePresence } from "framer-motion"
import { useMemo, useState } from "react"

import { useCanvasStore } from "../store/canvasStore"
import type { ModelId } from "./Models"

type TokenBalance = {
  tokens: number
  premiumTokens: number
}

type OverlayProps = PromptProps & {
  onAddBox?: () => void
  onDeleteSelected?: () => void
  onSetBackground?: () => void
  onSelectStyle?: (styleId: string) => void
  onSelectModel?: (modelId: ModelId) => void
  contextLabel?: string | null
  tokenBalance: TokenBalance
  tokenCost: number
}

export default function Overlay({
  onAddBox,
  onDeleteSelected,
  onSetBackground,
  onSelectStyle,
  onSelectModel,
  contextLabel,
  tokenBalance,
  tokenCost,
  ...promptProps
}: OverlayProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)
  const { boxes, selectedBoxId, onboardingStep } = useCanvasStore()

  const activeBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) ?? null,
    [boxes, selectedBoxId]
  )
  const activeBoxName = contextLabel ?? activeBox?.name ?? null
  const activeStyleId = activeBox?.styleId ?? "default"

  const tools = [
    {
      icon: <PlusIcon size={18} strokeWidth={2.9} />,
      label: "Add",
      description: "Add a new content box",
      onClick: () => onAddBox?.(),
    },
    {
      icon: <Trash2Icon size={18} strokeWidth={2} />,
      label: "Delete",
      description: "Delete the selected box",
      onClick: () => onDeleteSelected?.(),
    },
    {
      icon: <ImageIcon size={18} strokeWidth={2} />,
      label: "Background",
      description: "Set the canvas background",
      onClick: () => onSetBackground?.(),
    },
  ]
  return (
    <div
      className="absolute top-0 left-0 w-full h-full z-[110] pointer-events-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto">
        <div className="flex items-center justify-end gap-2 px-6 py-3">
          <TokenBadge label="Tokens" value={tokenBalance.tokens} />
          <TokenBadge label="Premium" value={tokenBalance.premiumTokens} variant="premium" />
        </div>
        <Prompt
          {...promptProps}
          activeBoxName={activeBoxName}
          activeModelId={activeBox?.model ?? "gemini"}
          activeStyleId={activeStyleId}
          onSelectStyle={onSelectStyle}
          onSelectModel={onSelectModel}
          tokenCost={tokenCost}
        />
        <motion.div
          initial={{ opacity: 0, x: -100, scale: 0 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -100, scale: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className={`absolute top-[50%] left-0 translate-y-[-50%] p-[10px] ${
            onboardingStep === "add-box" ? "z-[120]" : ""
          }`}
        >
          <div className="flex flex-col gap-[6px] rounded-2xl border border-slate-200 bg-white p-[6px] shadow-sm dark:border-white/10 dark:bg-neutral-900">
            {tools.map((tool) => (
              <div
                key={tool.label}
                data-toolbar-add={tool.label === "Add" ? "true" : undefined}
                className="flex relative cursor-pointer items-center justify-center rounded-xl p-[10px] hover:bg-slate-100 dark:hover:bg-neutral-800"
                onClick={tool.onClick}
                onMouseEnter={() => setHoveredTool(tool.label)}
                onMouseLeave={() => setHoveredTool(null)}
              >
                {tool.icon}
                {/* Tooltip with Framer Motion */}
                <AnimatePresence>
                  {hoveredTool === tool.label && (
                    <motion.div
                      initial={{ opacity: 0, x: -10, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -10, scale: 0.8 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        duration: 0.2,
                      }}
                      className="absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-[12px] text-white shadow-lg dark:bg-neutral-900"
                    >
                      {tool.description}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function TokenBadge({
  label,
  value,
  variant = "default",
}: {
  label: string
  value: number
  variant?: "default" | "premium"
}) {
  const isPremium = variant === "premium"
  return (
    <div
      className={`rounded-2xl border px-3 py-2 text-left ${
        isPremium
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-200/40 dark:bg-amber-400/10 dark:text-amber-50"
          : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-white/70">
        {label}
      </p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  )
}
