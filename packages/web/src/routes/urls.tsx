import { useState, type FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useAccount } from "jazz-tools/react"
import { ViewerAccount, type SavedUrl } from "@/lib/jazz/schema"
import { Link2, Plus, Trash2, ExternalLink } from "lucide-react"

export const Route = createFileRoute("/urls")({
  component: UrlsPage,
  ssr: false,
})

function UrlsPage() {
  const { data: session, isPending: authPending } = authClient.useSession()
  const me = useAccount(ViewerAccount)

  const [newUrl, setNewUrl] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  if (authPending) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <div className="text-center space-y-4">
          <p className="text-slate-400">Please sign in to save URLs</p>
          <a
            href="/auth"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  const root = me.$isLoaded ? me.root : null
  const urlList = root?.$isLoaded ? root.savedUrls : null

  if (!me.$isLoaded || !root?.$isLoaded) {
    return (
      <div className="min-h-screen text-white grid place-items-center">
        <p className="text-slate-400">Loading Jazz...</p>
      </div>
    )
  }

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

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link2 className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-semibold">Saved URLs</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add URL
          </button>
        </div>

        {isAdding && (
          <form
            onSubmit={handleAddUrl}
            className="mb-6 p-4 bg-[#0c0f18] border border-white/10 rounded-xl space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm text-white/70">URL</label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Title (optional)</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="My favorite site"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-4 py-2 rounded-lg text-sm text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
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
          <div className="text-center py-12 text-slate-400">
            <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No saved URLs yet</p>
            <p className="text-sm mt-1">Click "Add URL" to save your first link</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedUrls.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 bg-[#0c0f18] border border-white/5 rounded-xl hover:border-white/10 transition-colors group"
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
  )
}
