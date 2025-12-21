import { useEffect } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import { usersCollection } from "@/lib/collections"

export const Route = createFileRoute("/users")({
  ssr: false,
  beforeLoad: async () => {
    const res = await authClient.getSession()
    if (!res.data?.session) {
      throw redirect({ to: "/login" })
    }
  },
  loader: async () => {
    await usersCollection.preload()
    return null
  },
  component: UsersPage,
})

function UsersPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { data: users } = useLiveQuery((q) => q.from({ usersCollection }))

  useEffect(() => {
    if (!session?.session) {
      navigate({ to: "/login" })
    }
  }, [navigate, session])

  if (!session?.session) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="text-lg font-semibold">
              {session.user.email ?? session.user.id}
            </p>
          </div>
          <button
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400 transition-colors"
            onClick={async () => {
              await authClient.signOut()
              navigate({ to: "/login" })
            }}
          >
            Sign out
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Users (Electric)</h2>
            <span className="text-xs text-slate-400">
              Live-synced via Electric shape
            </span>
          </div>
          <div className="divide-y divide-slate-800">
            {users?.map((user) => (
              <div
                key={user.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <span className="text-xs text-slate-500">{user.id}</span>
              </div>
            ))}
            {!users?.length ? (
              <div className="px-4 py-6 text-center text-slate-400">
                No users yet. Create an account from the login screen to seed
                data.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
