import { useMemo, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Globe,
  MessageCircle,
  Zap,
  Loader2,
  Link2,
  ChevronDown,
  Search,
  ShieldCheck,
  Sparkles,
  Plus,
} from "lucide-react"

import ContextPanel from "./Context-panel"

type BlockLayoutProps = {
  activeTab: "blocks" | "marketplace"
  toolbar?: ReactNode
  subnav?: ReactNode
  children: ReactNode
}

type MarketplaceCard = {
  title: string
  author: string
  price: string
  tone: string
  accent: string
  badge?: string
}

export default function BlockLayout({
  activeTab,
  subnav,
  children,
}: BlockLayoutProps) {
  return (
    <div className="min-h-screen bg-[#05070e] text-white grid grid-cols-1 lg:grid-cols-[1fr_3fr] max-w-[1700px] mx-auto">
      <aside className="hidden lg:block h-screen overflow-y-auto">
        <ContextPanel chats={[]} />
      </aside>
      <main className="relative h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0" />
        <div className="relative h-screen overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <BlockNav activeTab={activeTab} />
            {activeTab === "blocks" ? <PublishButton /> : <MarketplaceSearch />}
          </div>

          {subnav ? <div className="mt-4">{subnav}</div> : null}

          <div className="mt-6 space-y-6">{children}</div>
        </div>
      </main>
    </div>
  )
}

function BlockNav({ activeTab }: { activeTab: "blocks" | "marketplace" }) {
  const tabs = [
    { id: "blocks", label: "My Blocks", to: "/blocks" },
    { id: "marketplace", label: "Marketplace", to: "/marketplace" },
  ] as const

  return (
    <div className="flex items-center gap-8">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className="relative pb-0.2 text-2xl -tracking-normal"
            activeOptions={{ exact: true }}
          >
            <span
              className={`transition-colors duration-200 ${
                isActive ? "text-white" : "text-white/50 hover:text-white/70"
              }`}
            >
              {tab.label}
            </span>
            {isActive ? (
              <span className="absolute inset-x-0 -bottom-0.5 flex h-[0.5px] items-center justify-center">
                <span className="h-[0.5px] w-full rounded-xl bg-linear-to-r from-amber-200 via-amber-100 to-amber-100/80 blur-[0.2px]" />
                <span className="absolute h-[14px] w-[120%] -z-10 bg-[radial-gradient(circle_at_center,rgba(255,179,71,0.35),transparent_65%)]" />
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}

function PublishButton() {
  return (
    <button
      type="button"
      className="relative overflow-hidden rounded-lg border border-amber-400/10 bg-linear-to-b from-[#412b26] to-[#44382a] px-4 py-1.5 text-sm text-white/70 hover:shadow-[0_2px_15px_rgba(68,56,42)] hover:text-white cursor-pointer"
    >
      Publish
    </button>
  )
}

export function MarketplaceSearch() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0f1117]/40 px-4 py-2 shadow-inner shadow-white/1">
      <Search className="h-4 w-4 text-white/70" />
      <input
        placeholder="Search Marketplace"
        className="flex-1 bg-[#0f1117]/40 text-white text-sm placeholder:text-white/70 focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}

export function MyBlocksView() {
  const owned: any[] = useMemo(
    () => [
      { name: "Stripe Integration", badge: "Action" },
      { name: "Notion", badge: "Action" },
      { name: "X API", badge: "Action" },
    ],
    [],
  )

  const custom: any[] = useMemo(
    () => [
      { name: "Gmail", badge: "Action" },
      { name: "Documentation Builder", badge: "Action" },
      { name: "Electron Docs", badge: "Action" },
      { name: "Open Image Editor Ideas", badge: "Action" },
    ],
    [],
  )

  return (
    <BlockLayout activeTab="blocks">
      <div
        // className="grid gap-6 lg:grid-cols-[1fr_2fr]"
        className="flex flex-row"
      >
        <div className="space-y-4">
          <BlockListGroup title="Owned" items={owned} />
          <BlockListGroup title="Custom" items={custom} />
          <button className="group flex gap-2 w-full items-center cursor-pointer text-sm text-white/70 transition hover:text-white">
            <Plus className="h-4 w-4" />
            New block
          </button>
        </div>
        <CreateBlockPanel />
      </div>
    </BlockLayout>
  )
}

function BlockListGroup({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between text-sm font-semibold text-white">
        <span>{title}</span>
        <ChevronRight className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-sm text-slate-200"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center">↗</div>
              <span>{item.name}</span>
            </div>
            {item.badge ? (
              <span className="rounded-lg bg-white/4 px-2 py-1 text-xs text-white/70">
                {item.badge}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateBlockPanel() {
  const [blockType, setBlockType] = useState<
    "text" | "web" | "thread" | "action"
  >("web")
  const [options, setOptions] = useState({
    update: true,
    deepScan: true,
    summarise: false,
    sections: true,
    updateInterval: "1 hour",
    deepScanLevel: "5 levels",
  })

  const blockTypes = [
    { id: "text", label: "Text", icon: FileText },
    { id: "web", label: "Web", icon: Globe },
    { id: "thread", label: "Thread", icon: MessageCircle },
    { id: "action", label: "Action", icon: Zap },
  ] as const

  const scanning = [
    {
      name: "nikiv.dev",
      tokens: "2,284",
      children: [
        { name: "/intro", tokens: "508" },
        { name: "/code", tokens: "508" },
        { name: "/focus", tokens: "508" },
      ],
    },
    {
      name: "Open Image Editor Ideas",
      tokens: "5,582",
      children: [
        { name: "/intro", tokens: "508" },
        { name: "/code", tokens: "508" },
        { name: "/focus", tokens: "508" },
      ],
    },
  ]

  const initialSelection = useMemo(() => {
    const map: Record<string, boolean> = {}
    scanning.forEach((item) => {
      map[item.name] = true
      item.children?.forEach((child) => {
        map[`${item.name}/${child.name}`] = true
      })
    })
    return map
  }, [scanning])
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>(
    () => initialSelection,
  )

  const togglePath = (path: string) =>
    setSelectedPaths((prev) => ({ ...prev, [path]: !prev[path] }))

  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {}
      scanning.forEach((item) => {
        if (item.children?.length) map[item.name] = true
      })
      return map
    },
  )

  const toggleExpand = (path: string) =>
    setExpandedPaths((prev) => ({ ...prev, [path]: !prev[path] }))

  return (
    <div className="rounded-2xl bg-[#181921d9]/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold text-white">Create block</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {blockTypes.map((type) => {
          const isActive = blockType === type.id
          const Icon = type.icon
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setBlockType(type.id)}
              className={`group relative flex h-full flex-col cursor-pointer justify-center items-center gap-4 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                isActive
                  ? " bg-linear-to-br border-white/15 shadow-[0_1px_1px_rgba(255, 255, 255, 0.8)] from-blue-300/10 via-blue-400/15 to-purple-400/30"
                  : "border-white/5 bg-white/3 hover:border-white/20 text-white/70 hover:bg-white/6"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{type.label}</span>
            </button>
          )
        })}
      </div>

      <div className="gap-2 flex flex-col">
        <label className="text-sm pb-2 uppercase tracking-[0.2em] text-white">
          URL
        </label>
        <div className="flex flex-col gap-3 rounded-lg bg-black/40 px-4 py-2 shadow-inner shadow-white/5 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="https://apple.com"
            className="flex-1 bg-[#0f1117]/40 text-white text-sm placeholder:text-neutral-500 focus:outline-none disabled:opacity-50"
            style={{ boxShadow: "1px 0.5px 10px 0 rgba(0,0,0,0.4) inset" }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_auto] lg:items-stretch">
        <OptionRow
          label="Update every"
          checked={options.update}
          onChange={() =>
            setOptions((prev) => ({ ...prev, update: !prev.update }))
          }
          select={{
            value: options.updateInterval,
            onChange: (value) =>
              setOptions((prev) => ({ ...prev, updateInterval: value })),
            options: ["30 min", "1 hour", "3 hours", "1 day"],
          }}
        />
        <OptionRow
          label="Summarise pages"
          checked={options.summarise}
          onChange={() =>
            setOptions((prev) => ({ ...prev, summarise: !prev.summarise }))
          }
        />
        <CreateCTA />
        <OptionRow
          label="Deep scan"
          checked={options.deepScan}
          onChange={() =>
            setOptions((prev) => ({ ...prev, deepScan: !prev.deepScan }))
          }
          select={{
            value: options.deepScanLevel,
            onChange: (value) =>
              setOptions((prev) => ({ ...prev, deepScanLevel: value })),
            options: ["3 levels", "5 levels", "7 levels"],
          }}
        />
        <OptionRow
          label="Create sections"
          checked={options.sections}
          onChange={() =>
            setOptions((prev) => ({ ...prev, sections: !prev.sections }))
          }
        />
      </div>

      <div>
        <div className="flex flex-col text-sm gap-4 text-white/70">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning...
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-white/70">
              <span className="text-white font-semibold">40</span> pages
            </p>
            <p className="text-sm text-white/70">
              <span className="text-white font-semibold">10</span> tokens
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2 py-3 text-sm text-slate-200">
          {scanning.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.children ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.name)}
                      className="flex h-6 w-6 items-center cursor-pointer justify-center text-white/70"
                      aria-expanded={expandedPaths[item.name]}
                    >
                      <ChevronRight
                        className={`h-5 w-5 transition ${
                          expandedPaths[item.name] ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="h-6 w-6" />
                  )}
                  <button
                    type="button"
                    onClick={() => togglePath(item.name)}
                    className="flex items-center gap-3 text-left"
                  >
                    <GradientCheckbox checked={selectedPaths[item.name]} />
                    <span className="font-medium text-white">{item.name}</span>
                  </button>
                </div>
                <span className="text-xs text-white/70 p-2 rounded-md bg-white/4">
                  {item.tokens}
                </span>
              </div>
              {item.children && expandedPaths[item.name] ? (
                <div className="mt-2 space-y-1 pl-10 text-slate-400">
                  {item.children.map((child) => (
                    <div
                      key={child.name}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-white/2"
                    >
                      <button
                        type="button"
                        onClick={() => togglePath(`${item.name}/${child.name}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <GradientCheckbox
                          checked={selectedPaths[`${item.name}/${child.name}`]}
                        />
                        <Link2 className="h-4 w-4 text-white/70" />
                        <span className="text-white">{child.name}</span>
                      </button>
                      <span className="text-xs text-white/70 p-2 rounded-md bg-white/4">
                        {child.tokens}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OptionRow({
  label,
  checked,
  onChange,
  select,
}: {
  label: string
  checked: boolean
  onChange: () => void
  select?: {
    value: string
    onChange: (value: string) => void
    options: string[]
  }
}) {
  const muted = !checked
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onChange}
        className="flex items-center gap-3 text-left"
        aria-pressed={checked}
      >
        <GradientCheckbox checked={checked} />
        <span
          className={`text-lg font-semibold tracking-tight ${
            muted ? "text-slate-400" : "text-white"
          }`}
        >
          {label}
        </span>
      </button>
      {select ? (
        <SoftSelect
          value={select.value}
          onChange={select.onChange}
          options={select.options}
          disabled={muted}
        />
      ) : (
        <div className="h-10 w-10 shrink-0" />
      )}
    </div>
  )
}

function GradientCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 items-center cursor-pointer justify-center rounded-md border text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition ${
        checked
          ? "border-amber-600/20 shadow-[1px_1px_3px_rgba(255,149,87,0.2)] bg-linear-to-b from-red-500/20 via-orange-400/20 to-amber-300/20"
          : "border-white/10 bg-black/40"
      }`}
    >
      {checked ? (
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="#ff9557"
          strokeWidth={3}
        >
          <path d="M5 11.5 8.5 15 15 6" />
        </svg>
      ) : null}
    </span>
  )
}

function SoftSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  disabled?: boolean
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-lg border px-6 py-1.5 border-none shadow-white/3 shadow-[1px_1px_0.5px_rgba(0,0,0,0.1)] pr-8 text-sm font-semibold  transition focus:outline-none ${
          disabled
            ? "bg-transparent text-slate-500 cursor-not-allowed"
            : "bg-black/50 text-white"
        }`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#0c0f18] text-white">
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

function CreateCTA() {
  const disabled = false
  return (
    <div className="flex items-center justify-end lg:row-span-2">
      <button
        disabled={disabled}
        type="button"
        className={
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#e5634f] via-[#ed7246] to-[#c25c29] px-5 py-3 text-base font-semibold text-white shadow-[0_2px_3px_rgba(255,175,71,0.45)] cursor-pointer"
        }
      >
        Create
      </button>
    </div>
  )
}

export function MarketplaceView() {
  const sections: { title: string; items: MarketplaceCard[] }[] = useMemo(
    () => [
      {
        title: "Featured",
        items: [
          {
            title: "Stripe Integration",
            author: "Stripe",
            price: "Free",
            tone: "bg-gradient-to-r from-indigo-400 via-blue-500 to-purple-500",
            accent: "border-indigo-300/40",
          },
          {
            title: "X API",
            author: "X",
            price: "$19.99",
            tone: "bg-gradient-to-r from-slate-900 via-neutral-800 to-slate-950",
            accent: "border-slate-500/40",
          },
          {
            title: "Notion",
            author: "Notion",
            price: "$11.99",
            tone: "bg-gradient-to-r from-amber-200 via-amber-100 to-white",
            accent: "border-amber-200/50",
          },
        ],
      },
      {
        title: "Trending",
        items: [
          {
            title: "Dev Mode MCP",
            author: "Figma",
            price: "Free",
            tone: "bg-gradient-to-r from-green-400 via-emerald-500 to-green-600",
            accent: "border-emerald-200/50",
          },
          {
            title: "Gmail API Tools",
            author: "hunter2",
            price: "$9.99",
            tone: "bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400",
            accent: "border-orange-300/60",
          },
          {
            title: "VS Code",
            author: "nikiv",
            price: "Free",
            tone: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900",
            accent: "border-slate-500/30",
          },
        ],
      },
      {
        title: "Recently published",
        items: [
          {
            title: "Spotify API",
            author: "greg3",
            price: "$6.99",
            tone: "bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600",
            accent: "border-emerald-200/50",
          },
          {
            title: "VS Code",
            author: "nikiv",
            price: "Free",
            tone: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900",
            accent: "border-slate-500/30",
          },
          {
            title: "Dev Mode MCP",
            author: "Figma",
            price: "$4.99",
            tone: "bg-gradient-to-r from-lime-400 via-green-500 to-emerald-600",
            accent: "border-lime-200/50",
          },
        ],
      },
    ],
    [],
  )

  return (
    <BlockLayout activeTab="marketplace" subnav={<MarketplaceFilters />}>
      <div className="grid gap-6">
        {sections.map((section) => (
          <div key={section.title} className="grid gap-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="sm:text-lg md:text-2xl font-semibold">
                {section.title}
              </h3>

              <button className="text-sm text-white/90 hover:text-white cursor-pointer">
                Show all
              </button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {section.items.map((item) => (
                <MarketplaceCardView key={item.title} card={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlockLayout>
  )
}

function MarketplaceFilters() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={true} text="Discover" />
        <FilterPill text="Featured" />
        <FilterPill text="Trending" />
        <FilterPill text="New" />
      </div>
      <div className="flex items-center gap-2">
        <FilterPill text="Owned" />
        <FilterPill text="Profile" />
      </div>
    </div>
  )
}

function FilterPill({ text, active }: { text: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-4 py-2 cursor-pointer text-sm transition ${
        active
          ? "border border-white/15 inset-shadow-2xl shadow-white rounded-lg bg-transparent text-white font-semibold"
          : "bg-transparent text-white/70 hover:text-white"
      }`}
    >
      {text}
    </button>
  )
}

function MarketplaceCardView({ card }: { card: MarketplaceCard }) {
  return (
    <div
      className={`relative flex h-46 flex-col justify-between overflow-hidden rounded-2xl  ${card.tone}`}
    >
      <div className="flex items-center h-[50%] mt-auto bg-linear-to-b from-[#252734] via-[#282a37] to-[#2c2d37] border border-t border-black/20 rounded-lg rounded-t-none p-4 justify-between">
        <div>
          <div className="text-md font-semibold drop-shadow-sm">
            {card.title}
          </div>
          <div className="text-sm text-white/80">
            by <span className="text-white font-semibold">{card.author}</span>
          </div>
        </div>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
          {card.price}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_40%)]" />
    </div>
  )
}
