import { motion, useAnimate } from "framer-motion"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"

import Models, { MODEL_OPTIONS, type ModelId } from "./Models"
import Styles from "./Styles"
import { STYLE_PRESETS } from "../styles-presets"
import { useCanvasStore } from "../store/canvasStore"

export type PromptProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => Promise<boolean> | boolean
  isGenerating: boolean
  error?: string | null
  activeBoxName?: string | null
  activeModelId?: "gemini" | "dall-e-3" | "nano-banana" | null
  activeStyleId?: string | null
  onSelectStyle?: (styleId: string) => void
  onSelectModel?: (modelId: ModelId) => void
  contextLabel?: string | null
  tokenCost?: number
}

export default function Prompt({
  value,
  onValueChange,
  onSubmit,
  isGenerating,
  error,
  activeBoxName,
  activeModelId = "gemini",
  activeStyleId = "default",
  onSelectStyle,
  onSelectModel,
  contextLabel,
  tokenCost = 1,
}: PromptProps) {
  const [currentCase, setCurrentCase] = useState<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { onboardingStep } = useCanvasStore()

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 250)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [autoResize, value])

  const handleSubmit = useCallback(async () => {
    if (isGenerating) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    await onSubmit(trimmed)
  }, [isGenerating, onSubmit, onValueChange, value])

  const activeModelLabel = MODEL_OPTIONS.find(
    (option) => option.id === activeModelId
  )?.label
  const activeStyle = STYLE_PRESETS.find(
    (preset) => preset.id === activeStyleId
  )

  return (
    <div
      className={`absolute bottom-0 left-[50%] translate-x-[-50%] flex justify-center items-center p-[10px] w-full max-w-[520px] ${
        onboardingStep === "enter-prompt" || onboardingStep === "generate-image"
          ? "z-[120]"
          : ""
      }`}
    >
      <PromptWrapper currentCase={currentCase} setCurrentCase={setCurrentCase}>
        {(() => {
          switch (currentCase) {
            case 0:
              return (
                <div className="flex w-full flex-col gap-2">
                  {activeBoxName || contextLabel ? (
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
                      <span className="uppercase tracking-wide">
                        Prompting {contextLabel ?? activeBoxName}
                      </span>
                      <div className="flex items-center gap-2">
                        {activeStyle && activeStyle.id !== "default" ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-white/70">
                            {activeStyle.label}
                          </span>
                        ) : null}
                        {activeModelLabel ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-white">
                            {activeModelLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <textarea
                    ref={textareaRef}
                    data-prompt-input="true"
                    data-generate-button="true"
                    className="h-[100px] min-h-[60px] max-h-[250px] w-full resize-none overflow-y-auto bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/50"
                    placeholder="Describe the image you want to see"
                    value={value}
                    onChange={(event) => onValueChange(event.target.value)}
                    onInput={autoResize}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleSubmit()
                      }
                    }}
                    aria-label="Image prompt"
                    aria-busy={isGenerating}
                  />
                  <div className="flex justify-between text-xs text-slate-500 dark:text-white/40">
                    <span>
                      Press Enter to generate • Shift+Enter for a new line
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-600 dark:text-white/60">
                        Cost: {tokenCost} premium token
                        {tokenCost !== 1 ? "s" : ""}
                      </span>
                      {isGenerating ? (
                        <span className="text-primary-300">Generating…</span>
                      ) : null}
                    </div>
                  </div>
                  {error ? (
                    <div className="text-xs text-red-400">{error}</div>
                  ) : null}
                </div>
              )
            case 1:
              return (
                <Models
                  onClose={() => setCurrentCase(0)}
                  onSelectModel={onSelectModel}
                />
              )
            case 2:
              return onSelectStyle ? (
                <Styles
                  onClose={() => setCurrentCase(0)}
                  onSelectStyle={onSelectStyle}
                  activeStyleId={activeStyleId ?? "default"}
                />
              ) : (
                <div className="text-sm text-slate-600 dark:text-white/60">
                  Style selection unavailable.
                </div>
              )
            default:
              return <div className="h-[50px]" />
          }
        })()}
      </PromptWrapper>
    </div>
  )
}

function PromptWrapper({
  children,
  currentCase,
  setCurrentCase,
}: {
  children: React.ReactNode | (() => React.ReactNode)
  currentCase: number
  setCurrentCase: (index: number) => void
}) {
  const constraintsRef = useRef<HTMLDivElement>(null)

  const tools = ["Prompt", "Models", "Styles"]

  const [scope, animate] = useAnimate()

  useEffect(() => {
    void animate(
      `#case-${currentCase}`,
      { opacity: [0, 1] },
      { duration: 0.5, delay: 0.5 }
    )
  }, [animate, currentCase])

  return (
    <div ref={scope} className="w-full">
      <div
        ref={constraintsRef}
        className=" flex justify-center w-full relative items-center"
      >
        {/* <div className="absolute z-10 left-[50%] translate-x-[-50%] top-[-30px] w-[90%] h-full  ">
          <div className="glass-card w-full h-full rounded-2xl">
            <div className="w-full h-[24px]  group flex items-center justify-center ">
              <div className="w-[40px] h-[5px] bg-neutral-700/40 group-hover:bg-neutral-700/70 transition-all duration-300 rounded-full"></div>
            </div>
          </div>
        </div> */}
        <motion.div
          layoutId="container"
          initial={{
            scale: 0.6,
            y: 100,
          }}
          animate={{
            scale: 1,
            y: 0,
          }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-20 w-full rounded-2xl bg-white p-0 text-slate-900 shadow-xl dark:bg-neutral-900 dark:text-white"
        >
          <div
            id={`case-${currentCase}`}
            className="relative flex flex-col justify-between   p-4 "
          >
            {typeof children === "function"
              ? (children as () => React.ReactNode)()
              : children}
          </div>
          <div className="flex absolute top-[-26px] left-0 z-[-10]  scrollbar-hide text-slate-600 gap-0.5  text-xs dark:text-white/80">
            {tools.map((tool, index) => (
              <Fragment key={tool}>
                <div
                  onClick={() => setCurrentCase(index)}
                  className={`cursor-pointer rounded-t-xl px-4 py-1 ${
                    index === currentCase
                      ? "h-[50px] bg-white text-slate-900 shadow transition-all duration-300 dark:bg-neutral-900 dark:text-white"
                      : "h-[40px] bg-slate-100 text-slate-500 opacity-70 dark:bg-neutral-900/70 dark:text-white/70"
                  }`}
                >
                  {tool}
                </div>
              </Fragment>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
