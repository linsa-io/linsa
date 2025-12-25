import { useState, useEffect, useRef } from "react"
import { Send, LogIn } from "lucide-react"
import { authClient } from "@/lib/auth-client"

type Comment = {
  id: string
  user_id: string
  user_name: string
  user_email: string
  content: string
  created_at: string
}

type AuthStep = "idle" | "email" | "otp"

interface CommentBoxProps {
  username: string
}

export function CommentBox({ username }: CommentBoxProps) {
  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Auth state
  const [authStep, setAuthStep] = useState<AuthStep>("idle")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")

  const commentsEndRef = useRef<HTMLDivElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)

  // Focus inputs when auth step changes
  useEffect(() => {
    if (authStep === "email") {
      emailInputRef.current?.focus()
    } else if (authStep === "otp") {
      otpInputRef.current?.focus()
    }
  }, [authStep])

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/stream-comments?username=${username}`)
        if (res.ok) {
          const data = (await res.json()) as { comments?: Comment[] }
          setComments(data.comments || [])
        }
      } catch (err) {
        console.error("Failed to fetch comments:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
    const interval = setInterval(fetchComments, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [username])

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setAuthLoading(true)
    setAuthError("")

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      if (result.error) {
        setAuthError(result.error.message || "Failed to send code")
      } else {
        setAuthStep("otp")
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to send verification code")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return

    setAuthLoading(true)
    setAuthError("")

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      })

      if (result.error) {
        setAuthError(result.error.message || "Invalid code")
      } else {
        // Success - close auth form
        setAuthStep("idle")
        setEmail("")
        setOtp("")
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to verify code")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !session?.user) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/stream-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          content: newComment.trim(),
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { comment: Comment }
        setComments((prev) => [...prev, data.comment])
        setNewComment("")
      }
    } catch (err) {
      console.error("Failed to post comment:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const isAuthenticated = !!session?.user

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white/80">Chat</h3>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-white/40 text-sm py-4">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-4">
            No messages yet. Be the first to say hi!
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="group">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white/70">
                    {comment.user_name?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-white/60 truncate">
                      {comment.user_name || "Anonymous"}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white/90 break-words">{comment.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3">
        {sessionLoading ? (
          <div className="text-center text-white/40 text-sm py-2">Loading...</div>
        ) : isAuthenticated ? (
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-3 py-2 bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        ) : authStep === "idle" ? (
          <button
            onClick={() => setAuthStep("email")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
          >
            <LogIn size={16} />
            Sign in to chat
          </button>
        ) : authStep === "email" ? (
          <form onSubmit={handleSendOTP} className="space-y-2">
            <input
              ref={emailInputRef}
              type="email"
              placeholder="Enter your email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
            {authError && (
              <p className="text-xs text-red-400">{authError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthStep("idle")
                  setAuthError("")
                }}
                className="px-3 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={authLoading || !email.trim()}
                className="flex-1 px-3 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors"
              >
                {authLoading ? "Sending..." : "Send code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-2">
            <p className="text-xs text-white/60 text-center">
              Code sent to {email}
            </p>
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
            {authError && (
              <p className="text-xs text-red-400">{authError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthStep("email")
                  setOtp("")
                  setAuthError("")
                }}
                className="px-3 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={authLoading || otp.length !== 6}
                className="flex-1 px-3 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors"
              >
                {authLoading ? "Verifying..." : "Sign in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
