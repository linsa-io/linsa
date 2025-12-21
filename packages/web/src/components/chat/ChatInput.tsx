import { useState, useRef, useEffect, useMemo } from "react"
import { ChevronDown } from "lucide-react"

const AVAILABLE_MODELS = [
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
  },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
] as const

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"]

function ModelSparkle() {
  return (
    <svg
      className="w-4 h-4"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_1212_3035)">
        <path
          d="M16 8.016C13.9242 8.14339 11.9666 9.02545 10.496 10.496C9.02545 11.9666 8.14339 13.9242 8.016 16H7.984C7.85682 13.9241 6.97483 11.9664 5.5042 10.4958C4.03358 9.02518 2.07588 8.14318 0 8.016L0 7.984C2.07588 7.85682 4.03358 6.97483 5.5042 5.5042C6.97483 4.03358 7.85682 2.07588 7.984 0L8.016 0C8.14339 2.07581 9.02545 4.03339 10.496 5.50397C11.9666 6.97455 13.9242 7.85661 16 7.984V8.016Z"
          fill="url(#paint0_radial_1212_3035)"
          style={{ stopColor: "#9168C0", stopOpacity: 1 }}
        />
      </g>
      <defs>
        <radialGradient
          id="paint0_radial_1212_3035"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(1.588 6.503) rotate(18.6832) scale(17.03 136.421)"
        >
          <stop
            offset="0.067"
            stopColor="#9168C0"
            style={{ stopColor: "#9168C0", stopOpacity: 1 }}
          />
          <stop
            offset="0.343"
            stopColor="#5684D1"
            style={{ stopColor: "#5684D1", stopOpacity: 1 }}
          />
          <stop
            offset="0.672"
            stopColor="#1BA1E3"
            style={{ stopColor: "#1BA1E3", stopOpacity: 1 }}
          />
        </radialGradient>
        <clipPath id="clip0_1212_3035">
          <rect
            width="16"
            height="16"
            fill="white"
            style={{ fill: "white", fillOpacity: 1 }}
          />
        </clipPath>
      </defs>
    </svg>
  )
}

interface ModelSelectProps {
  selectedModel: ModelId
  onChange: (model: ModelId) => void
}

function ModelSelect({ selectedModel, onChange }: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(
    () => AVAILABLE_MODELS.find((m) => m.id === selectedModel),
    [selectedModel],
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative select-none">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-white/8 bg-linear-to-b from-[#2d2e39] via-[#1e1f28] to-[#1a1b24] px-3 py-1.5 text-left shadow-inner shadow-black/40 hover:border-white/14 transition-colors min-w-[170px]"
      >
        <ModelSparkle />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">
            {selected?.name ?? "Choose model"}
          </span>
        </div>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180 text-neutral-300" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full z-20 my-1 max-w-52 overflow-hidden rounded-2xl border border-white/5 bg-[#0b0c11]/95 backdrop-blur-lg box-shadow-xl">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Models
          </div>
          <div className="flex flex-col py-1">
            {AVAILABLE_MODELS.map((model) => {
              const isActive = model.id === selectedModel
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onChange(model.id)
                    setOpen(false)
                  }}
                  className={`flex items-center hover:bg-white/2 rounded-lg gap-3 px-3 py-1 text-sm transition-colors ${isActive ? "text-white" : "text-white/65 hover:text-white"}`}
                >
                  <ModelSparkle />
                  <div className="flex flex-col cursor-pointer items-start">
                    <span className="text-[13px] font-semibold leading-tight">
                      {model.name}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface ChatInputProps {
  onSubmit: (message: string) => void
  isLoading: boolean
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  limitReached?: boolean
  remainingRequests?: number
}

export function ChatInput({
  onSubmit,
  isLoading,
  selectedModel,
  onModelChange,
  limitReached = false,
  remainingRequests,
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isLoading && !limitReached) {
      onSubmit(message)
      setMessage("")
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isDisabled = isLoading || limitReached
  const sendDisabled = !message.trim() || isDisabled

  return (
    <div className="px-4 pb-4">
      {limitReached && (
        <div className="max-w-4xl mx-auto mb-3 overflow-hidden rounded-[26px] border border-white/8 bg-linear-to-b from-[#0c1c27] via-[#0a1923] to-[#08141d] shadow-[0_18px_60px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex-1">
              <div className="text-lg font-semibold text-white">
                Sign in to continue chatting
              </div>
              <div className="text-sm text-neutral-300">
                Get more requests with a free account
              </div>
            </div>
            <a
              href="/login"
              className="shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-linear-to-b from-[#1ab8b0] via-[#0a8f8b] to-[#0ba58a] shadow-[0_16px_48px_rgba(0,0,0,0.45)] transition hover:brightness-110"
            >
              Sign in
            </a>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div
          className={`relative min-h-[6.5em] max-w-4xl mx-auto rounded-2xl border border-neutral-700/30 bg-[#181921d9]/90 px-3 p-4 backdrop-blur-lg transition-all hover:border-neutral-600/40 ${limitReached ? "opacity-80" : ""}`}
        >
          <textarea
            ref={textareaRef}
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="w-full max-h-32 min-h-[24px] resize-none overflow-y-auto bg-transparent text-[15px] text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-60 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            rows={3}
            disabled={isDisabled}
          />

          {limitReached && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-black/25 via-transparent to-black/30" />
          )}

          <div className="absolute bottom-0 left-0 p-2 w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ModelSelect
                selectedModel={selectedModel}
                onChange={onModelChange}
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              {typeof remainingRequests === "number" && (
                <span className="text-white/70">
                  {remainingRequests} requests remaining
                </span>
              )}
              <button
                type="submit"
                disabled={sendDisabled}
                className="flex py-2 px-3 cursor-pointer items-center justify-center text-white rounded-[10px] bg-linear-to-b from-[#5b9fbf] via-[#0d817f] to-[#069d7f] transition-colors duration-300 hover:bg-cyan-700 hover:text-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg box-shadow-xl"
                aria-label="Send message"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M0.184054 0.112806C0.258701 0.0518157 0.349387 0.0137035 0.445193 0.00305845C0.540999 -0.00758662 0.637839 0.00968929 0.724054 0.0528059L15.7241 7.55281C15.8073 7.59427 15.8773 7.65812 15.9262 7.73717C15.9751 7.81622 16.001 7.90734 16.001 8.00031C16.001 8.09327 15.9751 8.18439 15.9262 8.26344C15.8773 8.34249 15.8073 8.40634 15.7241 8.44781L0.724054 15.9478C0.637926 15.9909 0.541171 16.0083 0.445423 15.9977C0.349675 15.9872 0.25901 15.9492 0.184331 15.8884C0.109651 15.8275 0.0541361 15.7464 0.0244608 15.6548C-0.00521444 15.5631 -0.0077866 15.4649 0.0170539 15.3718L1.98305 8.00081L0.0170539 0.629806C-0.00790602 0.536702 -0.0054222 0.438369 0.0242064 0.346644C0.053835 0.25492 0.109345 0.173715 0.184054 0.112806ZM2.88405 8.50081L1.27005 14.5568L14.3821 8.00081L1.26905 1.44481L2.88405 7.50081H9.50005C9.63266 7.50081 9.75984 7.55348 9.85361 7.64725C9.94738 7.74102 10.0001 7.8682 10.0001 8.00081C10.0001 8.13341 9.94738 8.26059 9.85361 8.35436C9.75984 8.44813 9.63266 8.50081 9.50005 8.50081H2.88405Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export { AVAILABLE_MODELS }
