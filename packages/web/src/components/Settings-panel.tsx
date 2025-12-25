import { useMemo } from "react"
import {
  ArrowLeft,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
  CreditCard,
  Video,
} from "lucide-react"

type SettingsSection = "preferences" | "profile" | "streaming" | "billing"

interface UserProfile {
  name?: string | null
  email: string
  image?: string | null
}

interface SettingsPanelProps {
  activeSection: SettingsSection
  onSelect: (section: SettingsSection) => void
  profile?: UserProfile | null | undefined
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
  { id: "billing", label: "Manage Billing", icon: CreditCard },
]

function Avatar({ profile }: { profile?: UserProfile | null }) {
  const initial = useMemo(() => {
    if (!profile) return "G"
    return (
      profile.name?.slice(0, 1) ??
      profile.email?.slice(0, 1)?.toUpperCase() ??
      "G"
    )
  }, [profile])

  if (profile?.image) {
    return (
      <img
        src={profile.image}
        alt={profile.name ?? profile.email}
        className="w-9 h-9 rounded-full object-cover"
      />
    )
  }

  return (
    <div className="w-9 h-9 rounded-full bg-teal-600 text-white text-sm font-semibold grid place-items-center">
      {initial}
    </div>
  )
}

export default function SettingsPanel({
  activeSection,
  onSelect,
  profile,
}: SettingsPanelProps) {
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
          {navItems.map(({ id, label, icon: Icon }) => {
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
