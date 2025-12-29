import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import SettingsPanel from "@/components/Settings-panel"
import {
  Check,
  ChevronDown,
  LogOut,
  Sparkles,
  UserRoundPen,
  MessageCircle,
  HelpCircle,
  Copy,
  ExternalLink,
  Key,
  Trash2,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react"

type SectionId = "preferences" | "profile" | "streaming" | "api" | "billing"

const PLAN_CARD_NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  ssr: false,
})

// Feature flag: enable billing section
const BILLING_ENABLED = false

type Option = { value: string; label: string }

function InlineSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white/5 border border-white/10 text-white text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
        checked ? "bg-teal-500" : "bg-white/10"
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-0"
        }`}
      />
    </button>
  )
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/70 mt-0.5">{description}</p>
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  )
}

function SettingCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="bg-[#0c0f18] border border-white/5 rounded-2xl p-5 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.7)]">
      <h3 className="text-md font-semibold text-white mb-3">{title}</h3>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative p-8 bg-[#0c0f18] max-w-xl mx-auto flex flex-col gap-2 border border-white/10 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.6)] w-full animate-in fade-in-0 zoom-in-95 duration-300"
        onClickCapture={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? (
          <p className="text-md text-white/85 font-medium mt-1">
            {description}
          </p>
        ) : null}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {description ? (
        <p className="text-sm text-white/70 mt-1">{description}</p>
      ) : null}
    </div>
  )
}

function PreferencesSection() {
  const [theme, setTheme] = useState("Dark")
  const [autoplay, setAutoplay] = useState(true)
  const [lowLatency, setLowLatency] = useState(true)
  const [chatTimestamps, setChatTimestamps] = useState(false)

  return (
    <div id="preferences" className="scroll-mt-24">
      <SectionHeader
        title="Preferences"
        description="Customize your viewing experience."
      />
      <div className="space-y-5">
        <SettingCard title="Appearance">
          <SettingRow
            title="Interface theme"
            description="Select your preferred color scheme."
            control={
              <InlineSelect
                value={theme}
                options={[
                  { value: "Dark", label: "Dark" },
                  { value: "Light", label: "Light" },
                  { value: "System", label: "System" },
                ]}
                onChange={setTheme}
              />
            }
          />
        </SettingCard>

        <SettingCard title="Player">
          <SettingRow
            title="Autoplay streams"
            description="Automatically play streams when you visit a channel."
            control={
              <ToggleSwitch
                checked={autoplay}
                onChange={setAutoplay}
              />
            }
          />
          <SettingRow
            title="Low latency mode"
            description="Reduce stream delay for more real-time interaction."
            control={
              <ToggleSwitch
                checked={lowLatency}
                onChange={setLowLatency}
              />
            }
          />
        </SettingCard>

        <SettingCard title="Chat">
          <SettingRow
            title="Show timestamps"
            description="Display time next to chat messages."
            control={
              <ToggleSwitch
                checked={chatTimestamps}
                onChange={setChatTimestamps}
              />
            }
          />
        </SettingCard>
      </div>
    </div>
  )
}

function ProfileSection({
  profile: sessionProfile,
  onLogout,
  onChangeEmail,
}: {
  profile: { name?: string | null; email: string; username?: string | null; image?: string | null; bio?: string | null; website?: string | null } | null | undefined
  onLogout: () => Promise<void>
  onChangeEmail: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(sessionProfile)
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [image, setImage] = useState("")
  const [bio, setBio] = useState("")
  const [website, setWebsite] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Fetch full profile from API on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
          setUsername(data.username ?? "")
          setName(data.name ?? "")
          setImage(data.image ?? "")
          setBio(data.bio ?? "")
          setWebsite(data.website ?? "")
        }
      } catch {
        // Fall back to session data
        setUsername(sessionProfile?.username ?? "")
        setName(sessionProfile?.name ?? "")
        setImage(sessionProfile?.image ?? "")
        setBio(sessionProfile?.bio ?? "")
        setWebsite(sessionProfile?.website ?? "")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [sessionProfile])

  const initials = useMemo(() => {
    if (!profile) return "G"
    return (
      profile.name?.slice(0, 1) ??
      profile.email?.slice(0, 1)?.toUpperCase() ??
      "G"
    )
  }, [profile])

  const avatarUrl = image || `https://api.dicebear.com/7.x/initials/svg?seed=${username || profile?.email || "user"}`

  const handleSaveProfile = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          username: username.toLowerCase(),
          image: image || null,
          bio: bio || null,
          website: website || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    username !== (profile?.username ?? "") ||
    name !== (profile?.name ?? "") ||
    image !== (profile?.image ?? "") ||
    bio !== (profile?.bio ?? "") ||
    website !== (profile?.website ?? "")

  if (loading) {
    return (
      <div id="profile" className="scroll-mt-24">
        <SectionHeader
          title="Profile"
          description="Manage your account details and security."
        />
        <div className="space-y-5">
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div id="profile" className="scroll-mt-24">
      <SectionHeader
        title="Profile"
        description="Manage your account details and security."
      />
      <div className="space-y-5">
        <SettingCard title="Account">
          <div className="flex items-center gap-4 py-2">
            <div className="w-11 h-11 rounded-full bg-white/10 grid place-items-center text-lg font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1">
              <p className="text-md text-white font-semibold">
                {profile?.name ?? "Guest user"}
              </p>
              <p className="text-md text-white/85">{profile?.email ?? "-"}</p>
            </div>
            <button
              type="button"
              onClick={onChangeEmail}
              className="inline-flex items-center gap-2 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 transition-colors"
            >
              <UserRoundPen className="w-4 h-4" />
              Change email
            </button>
          </div>
        </SettingCard>

        <SettingCard title="Public Profile">
          <div className="space-y-4">
            {/* Profile Picture */}
            <div className="space-y-2">
              <label className="text-sm text-white/70">Profile Picture</label>
              <div className="flex items-center gap-4">
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full bg-white/10 object-cover"
                />
                <div className="flex-1">
                  <input
                    type="url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://example.com/your-photo.jpg"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <p className="text-xs text-white/50 mt-1">
                    Enter a URL to your profile picture
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Username</label>
              <div className="flex items-center gap-2">
                <span className="text-white/50">linsa.io/</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="username"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <p className="text-xs text-white/50">
                This is your public stream URL. Only lowercase letters, numbers, hyphens, and underscores.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              {saved && <span className="text-sm text-teal-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving || !hasChanges}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="Session">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2 text-sm text-white/70">
              <p className="font-medium text-white">Sign out</p>
              <p className="text-xs text-white/70">
                Sign out of your account on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:bg-rose-600/10 hover:text-rose-500 rounded-lg px-4 py-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </SettingCard>

        <SettingCard title="Support">
          <div className="flex items-start justify-between py-2">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-white">Get help</p>
              <p className="text-xs text-white/70">
                Join our Discord community or contact support.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://discord.com/invite/bxtD8x6aNF"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Discord
              </a>
              <a
                href="mailto:support@linsa.io"
                className="inline-flex items-center gap-2 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Support
              </a>
            </div>
          </div>
        </SettingCard>
      </div>
    </div>
  )
}

function StreamingSection({ username }: { username: string | null | undefined }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Stream settings
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [liveInputUid, setLiveInputUid] = useState("")
  const [customerCode, setCustomerCode] = useState("")
  const [streamKey, setStreamKey] = useState("")

  // Filter settings
  const [allowedApps, setAllowedApps] = useState<string[]>([])
  const [blockedApps, setBlockedApps] = useState<string[]>([])
  const [audioApps, setAudioApps] = useState<string[]>([])
  const [filterVersion, setFilterVersion] = useState(0)
  const [filterSaving, setFilterSaving] = useState(false)
  const [filterSaved, setFilterSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/stream/settings", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setTitle(data.title || "")
          setDescription(data.description || "")
          setLiveInputUid(data.cloudflare_live_input_uid || "")
          setCustomerCode(data.cloudflare_customer_code || "")
          setStreamKey(data.stream_key || "")
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false)
      }
    }

    const fetchFilterConfig = async () => {
      try {
        const res = await fetch("/api/stream-filter")
        if (res.ok) {
          const data = await res.json()
          setAllowedApps(data.allowedApps || [])
          setBlockedApps(data.blockedApps || [])
          setAudioApps(data.audioApps || [])
          setFilterVersion(data.version || 0)
        }
      } catch {
        // Ignore errors
      }
    }

    fetchSettings()
    fetchFilterConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/stream/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          cloudflare_live_input_uid: liveInputUid || null,
          cloudflare_customer_code: customerCode || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  const copyStreamKey = () => {
    navigator.clipboard.writeText(streamKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFilterSave = async () => {
    setFilterSaving(true)
    setFilterSaved(false)
    try {
      const res = await fetch("/api/stream-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedApps,
          blockedApps,
          audioApps,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFilterVersion(data.version)
        setFilterSaved(true)
        setTimeout(() => setFilterSaved(false), 2000)
      }
    } catch {
      // Ignore errors
    } finally {
      setFilterSaving(false)
    }
  }

  const streamUrl = username ? `https://linsa.io/${username}` : null

  return (
    <div id="streaming" className="scroll-mt-24">
      <SectionHeader
        title="Streaming"
        description="Configure your live stream settings."
      />
      <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-3">
        <span className="px-2 py-0.5 text-xs font-bold uppercase bg-purple-500 text-white rounded">Beta</span>
        <p className="text-sm text-purple-200">
          Streaming is currently in beta. Features may change and some functionality is still being developed.
        </p>
      </div>
      <div className="space-y-5">
        {loading ? (
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        ) : (
          <>
            <SettingCard title="Stream Info">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Stream Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Live Stream"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What are you streaming?"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
              </div>
            </SettingCard>

            <SettingCard title="Cloudflare Stream">
              <div className="space-y-4 py-2">
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                  <p className="text-sm text-teal-300">
                    Enter your Cloudflare Live Input UID to enable automatic stream detection.
                    Your stream will go live automatically when you start streaming.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Live Input UID</label>
                  <input
                    type="text"
                    value={liveInputUid}
                    onChange={(e) => setLiveInputUid(e.target.value)}
                    placeholder="e.g., bb7858eafc85de6c92963f3817477b5d"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
                  <p className="text-xs text-white/50">
                    Find this in your Cloudflare Stream dashboard under Live Inputs.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Customer Code (Optional)</label>
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    placeholder="Leave empty to use default"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
                  <p className="text-xs text-white/50">
                    Only needed if using your own Cloudflare account.
                  </p>
                </div>
              </div>
            </SettingCard>

            <SettingCard title="Stream Filters">
              <div className="space-y-4 py-2">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-300">
                    Control which apps appear in your stream. Changes apply live without restart.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Allowed Apps (comma-separated)</label>
                  <input
                    type="text"
                    value={allowedApps.join(", ")}
                    onChange={(e) => setAllowedApps(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g., zed, cursor, safari, warp"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-white/50">
                    Only these apps will be visible in the stream. Leave empty to allow all.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Blocked Apps (comma-separated)</label>
                  <input
                    type="text"
                    value={blockedApps.join(", ")}
                    onChange={(e) => setBlockedApps(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g., 1password, telegram, keychain"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-white/50">
                    These apps will be hidden from the stream even if allowed.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Audio Apps (comma-separated)</label>
                  <input
                    type="text"
                    value={audioApps.join(", ")}
                    onChange={(e) => setAudioApps(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g., spotify, arc"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-white/50">
                    Apps to capture audio from.
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-white/50">Config version: {filterVersion}</span>
                  <div className="flex items-center gap-2">
                    {filterSaved && <span className="text-sm text-teal-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
                    <button
                      type="button"
                      onClick={handleFilterSave}
                      disabled={filterSaving}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {filterSaving ? "Saving..." : "Save Filters"}
                    </button>
                  </div>
                </div>
              </div>
            </SettingCard>

            <SettingCard title="Your Stream">
              <div className="space-y-4 py-2">
                {streamUrl && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Stream URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-teal-400 text-sm">
                        {streamUrl}
                      </code>
                      <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
                {streamKey && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Stream Key</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-sm font-mono truncate">
                        {streamKey.slice(0, 8)}...{streamKey.slice(-4)}
                      </code>
                      <button
                        type="button"
                        onClick={copyStreamKey}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-white/50">
                      Use this key to stream to Linsa (coming soon).
                    </p>
                  </div>
                )}
              </div>
            </SettingCard>

            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              {saved && <span className="text-sm text-teal-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface ApiKeyData {
  id: string
  name: string
  last_used_at: string | null
  created_at: string
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyData[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/api-keys", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys || [])
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreateKey = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newKeyName || "Default" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create key")
      } else {
        setNewKey(data.key)
        setShowNewKey(true)
        setNewKeyName("")
        fetchKeys()
      }
    } catch {
      setError("Network error")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id))
      }
    } catch {
      // Ignore errors
    }
  }

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div id="api" className="scroll-mt-24">
      <SectionHeader
        title="API Keys"
        description="Manage your API keys for programmatic access."
      />
      <div className="space-y-5">
        {/* Create new key */}
        <SettingCard title="Create API Key">
          <div className="space-y-4 py-2">
            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
              <p className="text-sm text-teal-300">
                API keys allow you to access Linsa programmatically. Use them to save bookmarks, sync data, and integrate with other tools.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (optional)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={handleCreateKey}
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                {creating ? "Creating..." : "Create Key"}
              </button>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </div>
        </SettingCard>

        {/* New key display */}
        {newKey && (
          <SettingCard title="New API Key">
            <div className="space-y-4 py-2">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-300">
                  Copy this key now. You won't be able to see it again!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-teal-400 text-sm font-mono overflow-x-auto">
                  {showNewKey ? newKey : "•".repeat(40)}
                </code>
                <button
                  type="button"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
                >
                  {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={copyKey}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNewKey(null)}
                className="text-sm text-white/50 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </SettingCard>
        )}

        {/* Existing keys */}
        <SettingCard title="Your API Keys">
          <div className="py-2">
            {loading ? (
              <div className="h-20 bg-white/5 rounded-lg animate-pulse" />
            ) : keys.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">
                No API keys yet. Create one above.
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-white/50" />
                      <div>
                        <p className="text-sm font-medium text-white">{key.name}</p>
                        <p className="text-xs text-white/50">
                          Created {formatDate(key.created_at)} • Last used {formatDate(key.last_used_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingCard>

        {/* Usage example */}
        <SettingCard title="Usage">
          <div className="space-y-4 py-2">
            <p className="text-sm text-white/70">
              Use your API key to save bookmarks:
            </p>
            <pre className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white/80 overflow-x-auto">
{`curl -X POST https://linsa.io/api/bookmarks \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com",
    "title": "Example",
    "api_key": "lk_your_key_here"
  }'`}
            </pre>
          </div>
        </SettingCard>
      </div>
    </div>
  )
}

function BillingSection() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const res = await fetch("/api/stripe/billing", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setIsSubscribed(data.hasActiveSubscription)
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false)
      }
    }
    checkSubscription()
  }, [])

  const handleSubscribe = async () => {
    setSubscribing(true)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error("Failed to start checkout:", err)
    } finally {
      setSubscribing(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error("Failed to open billing portal:", err)
    }
  }

  return (
    <div id="billing" className="scroll-mt-24 mx-auto">
      <SectionHeader
        title="Subscription"
        description="Manage your Linsa Pro subscription."
      />

      <div className="max-w-xl">
        {/* Plan Card */}
        <div
          className="rounded-3xl p-6 border border-white/10 relative overflow-hidden"
          style={{
            backgroundImage: `url("${PLAN_CARD_NOISE}")`,
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            backgroundBlendMode: "overlay, normal",
          }}
        >
          {isSubscribed && (
            <span className="absolute top-4 right-4 text-xs px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
              Active
            </span>
          )}

          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-teal-400" />
            <h3 className="text-2xl font-bold text-white">Linsa Pro</h3>
          </div>

          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-bold text-white">$8</span>
            <span className="text-white/60">/ month</span>
          </div>

          <ul className="space-y-3 mb-6">
            <li className="flex items-center gap-3 text-white/90">
              <Check className="w-5 h-5 text-teal-400 shrink-0" />
              <span>Unlimited stream replays</span>
            </li>
            <li className="flex items-center gap-3 text-white/90">
              <Check className="w-5 h-5 text-teal-400 shrink-0" />
              <span>HD streaming quality</span>
            </li>
            <li className="flex items-center gap-3 text-white/90">
              <Check className="w-5 h-5 text-teal-400 shrink-0" />
              <span>Priority support</span>
            </li>
          </ul>

          {loading ? (
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          ) : isSubscribed ? (
            <button
              type="button"
              onClick={handleManageBilling}
              className="w-full py-3 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors"
            >
              Manage Billing
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white transition-colors disabled:opacity-50"
            >
              {subscribing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                "Subscribe Now"
              )}
            </button>
          )}
        </div>

        {!isSubscribed && !loading && (
          <p className="text-center text-white/50 text-sm mt-4">
            Cancel anytime. No questions asked.
          </p>
        )}
      </div>
    </div>
  )
}

function SettingsPage() {
  const { data: session, isPending } = authClient.useSession()
  const [activeSection, setActiveSection] = useState<SectionId>("preferences")
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailInput, setEmailInput] = useState("")

  const handleLogout = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  const openEmailModal = () => {
    setEmailInput(session?.user?.email ?? "")
    setShowEmailModal(true)
  }

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault()
    setShowEmailModal(false)
  }

  if (isPending) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen max-w-5xl mx-auto text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 flex gap-6">
          <SettingsPanel
            activeSection={activeSection}
            onSelect={setActiveSection}
            profile={session?.user}
            showBilling={BILLING_ENABLED}
          />
          <div className="flex-1 space-y-12 overflow-auto pr-1 pb-12">
            {activeSection === "preferences" ? (
              <PreferencesSection />
            ) : activeSection === "profile" ? (
              <ProfileSection
                profile={session?.user}
                onLogout={handleLogout}
                onChangeEmail={openEmailModal}
              />
            ) : activeSection === "streaming" ? (
              <StreamingSection username={session?.user?.username} />
            ) : activeSection === "api" ? (
              <ApiKeysSection />
            ) : activeSection === "billing" && BILLING_ENABLED ? (
              <BillingSection />
            ) : null}
          </div>
        </div>
      </div>

      {showEmailModal ? (
        <Modal
          title="Change email"
          description="Enter the new email address you would like to use."
          onClose={() => setShowEmailModal(false)}
        >
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              className="w-full bg-white/2 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-100/40 focus:border-transparent"
              placeholder="email@example.com"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
              >
                Save email
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

    </>
  )
}
