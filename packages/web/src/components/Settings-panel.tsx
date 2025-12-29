import {
  ArrowLeft,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
  CreditCard,
  Video,
  Key,
} from "lucide-react"

type SettingsSection = "preferences" | "profile" | "streaming" | "api" | "billing"

interface UserProfile {
  name?: string | null
  email: string
  image?: string | null
}

interface SettingsPanelProps {
  activeSection: SettingsSection
  onSelect: (section: SettingsSection) => void
  profile?: UserProfile | null | undefined
  showBilling?: boolean
}

type NavItem = {
  id: SettingsSection
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "streaming", label: "Streaming", icon: Video },
  { id: "api", label: "API Keys", icon: Key },
  { id: "billing", label: "Manage Billing", icon: CreditCard },
]


export default function SettingsPanel({
  activeSection,
  onSelect,
  profile,
  showBilling = false,
}: SettingsPanelProps) {
  const filteredNavItems = showBilling
    ? navItems
    : navItems.filter((item) => item.id !== "billing")

  return (
    <aside className="shrink-0 bg-transparent border border-white/5 rounded-2xl h-[calc(100vh-6em)] sticky top-6 px-2 py-4 items-start flex flex-col gap-6">
      <div className="flex flex-col gap-2 items-start w-full">
        <div className="space-y-2">
          <a
            href="/"
            className="inline-flex items-start gap-2 px-6 py-2.5 text-white/80 hover:text-white text-sm transition-colors w-full justify-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to app</span>
          </a>
          {filteredNavItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`w-full justify-start hover:cursor-pointer flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-white/4 text-white"
                    : "text-white/80 hover:bg-white/2 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!profile ? (
        <div className="mt-auto space-y-3">
          <a
            href={profile ? "/settings" : "/login"}
            className="block w-full text-center text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors rounded-lg py-2"
          >
            Sign in
          </a>
        </div>
      ) : null}
    </aside>
  )
}
