import { useState, useEffect, type FormEvent } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ShaderBackground } from "@/components/ShaderBackground"
import { LiveNowSidebar } from "@/components/LiveNowSidebar"
import { authClient } from "@/lib/auth-client"
import { useAccount } from "jazz-tools/react"
import { ViewerAccount, type SavedUrl } from "@/lib/jazz/schema"
import { JazzProvider } from "@/lib/jazz/provider"
import { Link2, Plus, Trash2, ExternalLink, Video, Settings, LogOut, Layers } from "lucide-react"

// Feature flag: only this email can access stream features
const STREAM_ENABLED_EMAIL = "nikita@nikiv.dev"

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <ShaderBackground />
      <LiveNowSidebar />

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-6xl font-bold tracking-tight drop-shadow-2xl">
          Linsa
        </h1>
        <p className="mt-4 text-xl text-white/80 drop-shadow-lg">
          Save anything. Share, sell or collaborate. Privately.
        </p>
        <Link
          to="/auth"
          className="mt-8 rounded-full bg-white px-8 py-3 text-lg font-semibold text-black transition-all hover:bg-white/90 hover:scale-105"
        >
          Sign up
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <a
            href="https://x.com/linsa_io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            @linsa_io
          </a>
          <span className="text-white/30">·</span>
          <a
            href="https://github.com/linsa-io/linsa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Open Source
          </a>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { data: session } = authClient.useSession()
  const me = useAccount(ViewerAccount)

  const [newUrl, setNewUrl] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const canAccessStreams = session?.user?.email === STREAM_ENABLED_EMAIL

  const root = me.$isLoaded ? me.root : null
  const urlList = root?.$isLoaded ? root.savedUrls : null
  const savedUrls: SavedUrl[] = urlList?.$isLoaded ? [...urlList] : []

  const handleAddUrl = (e: FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim() || !root?.savedUrls?.$isLoaded) return

    root.savedUrls.$jazz.push({
      url: newUrl.trim(),
      title: newTitle.trim() || null,
      createdAt: Date.now(),
    })

    setNewUrl("")
    setNewTitle("")
    setIsAdding(false)
  }

  const handleDeleteUrl = (index: number) => {
    if (!root?.savedUrls?.$isLoaded) return
    root.savedUrls.$jazz.splice(index, 1)
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.reload()
  }

  if (!me.$isLoaded || !root?.$isLoaded) {
    return <div className="min-h-screen bg-black" />
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-neutral-400 text-sm">{session?.user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stream Setup - Only for nikita@nikiv.dev */}
        {canAccessStreams && (
          <div className="mb-8 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Video className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-semibold">Stream Setup</h2>
            </div>
            <p className="text-neutral-400 mb-4">
              Manage your live stream and archive settings.
            </p>
            <div className="flex gap-3">
              <Link
                to="/nikiv"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 transition-colors"
              >
                View Stream
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
              >
                Stream Settings
              </Link>
            </div>
          </div>
        )}

        {/* Browser Sessions */}
        <div className="mb-8 p-6 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-6 h-6 text-teal-400" />
            <h2 className="text-xl font-semibold">Browser Sessions</h2>
          </div>
          <p className="text-neutral-400 mb-4">
            Save your browser tabs to access them anywhere. Synced across all devices.
          </p>
          <Link
            to="/sessions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            Open Sessions
          </Link>
        </div>

        {/* Saved Links */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-teal-400" />
              <h2 className="text-xl font-semibold">Saved Links</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Link
            </button>
          </div>

          {isAdding && (
            <form
              onSubmit={handleAddUrl}
              className="mb-6 p-4 bg-black/30 border border-white/10 rounded-xl space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm text-white/70">URL</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Title (optional)</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="My favorite site"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setNewUrl("")
                    setNewTitle("")
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-neutral-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {savedUrls.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No saved links yet</p>
              <p className="text-sm mt-1">Click "Add Link" to save your first bookmark</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedUrls.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 bg-black/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.title || item.url}
                    </p>
                    {item.title && (
                      <p className="text-xs text-white/50 truncate mt-1">
                        {item.url}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteUrl(index)}
                      className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="min-h-screen bg-black" />
  }

  if (session?.user) {
    return (
      <JazzProvider>
        <Dashboard />
      </JazzProvider>
    )
  }

  return <LandingPage />
}

export const Route = createFileRoute("/")({
  component: HomePage,
  ssr: false,
})
