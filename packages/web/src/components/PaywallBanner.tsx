import { Lock, Sparkles } from "lucide-react"
import { Link } from "@tanstack/react-router"

interface PaywallBannerProps {
  creatorName: string
  creatorUsername: string
  isAuthenticated: boolean
}

export function PaywallBanner({ creatorName, creatorUsername, isAuthenticated }: PaywallBannerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
          <Lock className="w-10 h-10 text-white/60" />
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Heading */}
      <h3 className="text-2xl font-bold text-white mb-3">
        Premium Content
      </h3>

      {/* Description */}
      <p className="text-white/60 text-base max-w-md mb-8">
        Subscribe to <span className="text-white font-medium">{creatorName}</span> to access their past stream replays and exclusive content
      </p>

      {/* Benefits */}
      <div className="flex flex-col gap-2 mb-8 text-left max-w-sm">
        <div className="flex items-start gap-3 text-white/70 text-sm">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span>Watch all past stream recordings</span>
        </div>
        <div className="flex items-start gap-3 text-white/70 text-sm">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span>Access exclusive behind-the-scenes content</span>
        </div>
        <div className="flex items-start gap-3 text-white/70 text-sm">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span>Support {creatorName}'s work</span>
        </div>
      </div>

      {/* CTA Button */}
      {isAuthenticated ? (
        <Link
          to={`/${creatorUsername}/subscribe`}
          className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-full transition-all transform hover:scale-105"
        >
          Subscribe Now
        </Link>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            to="/auth"
            search={{ redirect: `/${creatorUsername}` }}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-full transition-all transform hover:scale-105"
          >
            Sign In to Subscribe
          </Link>
          <p className="text-white/40 text-xs">
            New to Linsa? <Link to="/auth" className="text-purple-400 hover:underline">Create an account</Link>
          </p>
        </div>
      )}
    </div>
  )
}
