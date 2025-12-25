import { ExternalLink, MapPin, Calendar, Users } from "lucide-react"

interface ProfileSidebarProps {
  user: {
    id: string
    name: string | null
    username: string
    image: string | null
    bio?: string | null
    website?: string | null
    location?: string | null
    joinedAt?: string | null
  }
  isLive?: boolean
  viewerCount?: number
  children?: React.ReactNode
}

export function ProfileSidebar({ user, isLive, viewerCount, children }: ProfileSidebarProps) {
  const displayName = user.name || user.username

  return (
    <div className="h-full flex flex-col bg-black border-l border-white/10">
      {/* Profile Header */}
      <div className="p-4 border-b border-white/10">
        {/* Name and Live Badge */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
              {isLive && (
                <span className="px-2 py-0.5 text-xs font-bold uppercase bg-red-500 text-white rounded">
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-white/60">@{user.username}</p>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="mt-3 text-sm text-white/80 leading-relaxed">{user.bio}</p>
        )}

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50">
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {user.location}
            </span>
          )}
          {user.website && (
            <a
              href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-teal-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {user.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {user.joinedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Joined {new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>

        {/* Stats */}
        {isLive && viewerCount !== undefined && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-white/70">
              <Users className="w-4 h-4 text-red-400" />
              <span className="font-medium text-white">{viewerCount}</span> watching
            </span>
          </div>
        )}
      </div>

      {/* Children (Chat, etc.) */}
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
