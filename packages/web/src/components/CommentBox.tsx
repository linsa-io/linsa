import { useState, useEffect, useRef } from "react"
import { Send, LogIn, ImagePlus, X } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useAccount, useCoState } from "jazz-tools/react"
import { Group, co, FileStream } from "jazz-tools"
import {
  StreamComment,
  StreamCommentList,
  StreamCommentsContainer,
  ViewerAccount,
} from "@/lib/jazz/schema"

interface CommentBoxProps {
  username: string
}

export function CommentBox({ username }: CommentBoxProps) {
  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const me = useAccount(ViewerAccount)

  const [containerId, setContainerId] = useState<string | undefined>(undefined)
  const container = useCoState(StreamCommentsContainer, containerId, { resolve: { comments: true } })
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Auth state
  const [authStep, setAuthStep] = useState<"idle" | "email" | "otp">("idle")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState("")

  const commentsEndRef = useRef<HTMLDivElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Focus inputs when auth step changes
  useEffect(() => {
    if (authStep === "email") {
      emailInputRef.current?.focus()
    } else if (authStep === "otp") {
      otpInputRef.current?.focus()
    }
  }, [authStep])

  // Initialize or load the comments container for this stream
  useEffect(() => {
    if (!me?.$isLoaded) return

    const initContainer = async () => {
      try {
        const containerUID = { stream: username, origin: "linsa.io", type: "comments" }

        // Create a group writable by everyone
        const group = Group.create({ owner: me })
        group.addMember("everyone", "writer")

        // Upsert the container
        const result = await StreamCommentsContainer.upsertUnique({
          value: { comments: StreamCommentList.create([], { owner: group }) },
          unique: containerUID,
          owner: group,
        })

        setContainerId(result.$jazz.id)
      } catch (err) {
        console.error("Failed to init comments container:", err)
      }
    }

    initContainer()
  }, [me?.$isLoaded, username])

  // Get comments from the container (only when loaded)
  const comments = container?.$isLoaded ? container.comments : undefined

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments?.length])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB")
      return
    }

    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearSelectedImage = () => {
    setSelectedImage(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

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
    const commentsList = container?.$isLoaded ? container.comments : undefined
    if ((!newComment.trim() && !selectedImage) || !session?.user || !me?.$isLoaded || !commentsList?.$isLoaded) return

    setIsSubmitting(true)
    setUploadProgress(0)

    try {
      // Create a group for the comment
      const group = Group.create({ owner: me })
      group.addMember("everyone", "reader")

      // Upload image if selected
      let imageStream = undefined
      if (selectedImage) {
        imageStream = await co.fileStream().createFromBlob(selectedImage, {
          owner: group,
          onProgress: (progress) => {
            setUploadProgress(Math.round(progress * 100))
          },
        })
      }

      // Create the comment
      const comment = StreamComment.create(
        {
          content: newComment.trim(),
          userName: session.user.name || session.user.email?.split("@")[0] || "Anonymous",
          userId: session.user.id || null,
          image: imageStream,
          createdAt: Date.now(),
        },
        { owner: group }
      )

      // Add to list
      ;(commentsList as unknown as { push: (item: typeof comment) => void }).push(comment)

      // Clear form
      setNewComment("")
      clearSelectedImage()
      setUploadProgress(0)
    } catch (err) {
      console.error("Failed to post comment:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
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
        {!comments ? (
          <div className="text-center text-white/40 text-sm py-4">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-white/40 text-sm py-4">
            No messages yet. Be the first to say hi!
          </div>
        ) : (
          comments.map((comment, index: number) => {
            if (!comment?.$isLoaded) return null

            return (
              <div key={comment.$jazz.id || index} className="group">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-white/70">
                      {comment.userName?.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-white/60 truncate">
                        {comment.userName || "Anonymous"}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {formatTime(comment.createdAt)}
                      </span>
                    </div>
                    {comment.content && (
                      <p className="text-sm text-white/90 break-words">{comment.content}</p>
                    )}
                    {comment.image?.$isLoaded && <CommentImage image={comment.image} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 p-3">
        {sessionLoading ? (
          <div className="text-center text-white/40 text-sm py-2">Loading...</div>
        ) : isAuthenticated ? (
          <div className="space-y-2">
            {/* Image preview */}
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-24 rounded-lg border border-white/20"
                />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute -top-2 -right-2 p-1 bg-black/80 rounded-full text-white/70 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Upload progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-white/10 rounded-full h-1">
                <div
                  className="bg-teal-500 h-1 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-2 text-white/50 hover:text-white/80 transition-colors"
                disabled={isSubmitting}
              >
                <ImagePlus size={18} />
              </button>
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
                disabled={(!newComment.trim() && !selectedImage) || isSubmitting}
                className="px-3 py-2 bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
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
            {authError && <p className="text-xs text-red-400">{authError}</p>}
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
            <p className="text-xs text-white/60 text-center">Code sent to {email}</p>
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
            {authError && <p className="text-xs text-red-400">{authError}</p>}
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

// Component to display an image from a FileStream
function CommentImage({ image }: { image: FileStream }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!image) return

    try {
      const blob = image.toBlob()
      if (blob) {
        const objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
      }
    } catch {
      // Image still loading
    }
  }, [image])

  if (!url) {
    return (
      <div className="mt-2 w-32 h-24 bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-xs text-white/30">Loading...</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Attached"
      className="mt-2 max-w-full max-h-48 rounded-lg border border-white/10 cursor-pointer hover:border-white/30 transition-colors"
      onClick={() => window.open(url, "_blank")}
    />
  )
}
