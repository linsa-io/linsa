import { useState, useEffect, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Mail, Apple, Github } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
})

type Step = "email" | "otp"

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" y1="8" x2="12" y2="8" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
    </svg>
  )
}

function AuthPage() {
  const [step, setStep] = useState<Step>("email")
  const emailInputRef = useRef<HTMLInputElement>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === "email") {
      emailInputRef.current?.focus()
    } else {
      otpInputRef.current?.focus()
    }
  }, [step])

  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError("")

    console.log("[auth-page] Sending OTP to:", email)

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      console.log("[auth-page] OTP result:", result)

      if (result.error) {
        console.error("[auth-page] OTP error:", result.error)
        setError(result.error.message || "Failed to send code")
      } else {
        console.log("[auth-page] OTP sent successfully, moving to OTP step")
        setStep("otp")
      }
    } catch (err) {
      console.error("[auth-page] Send OTP exception:", err)
      setError(err instanceof Error ? err.message : "Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return

    setIsLoading(true)
    setError("")

    console.log("[auth-page] Verifying OTP for:", email)

    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      })

      console.log("[auth-page] Verify result:", result)

      if (result.error) {
        console.error("[auth-page] Verify error:", result.error)
        setError(result.error.message || "Invalid code")
      } else {
        console.log("[auth-page] Sign in successful, redirecting...")
        window.location.href = "/"
      }
    } catch (err) {
      console.error("[auth-page] Verify OTP exception:", err)
      setError(err instanceof Error ? err.message : "Failed to verify code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsLoading(true)
    setError("")
    setOtp("")

    console.log("[auth-page] Resending OTP to:", email)

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      console.log("[auth-page] Resend result:", result)

      if (result.error) {
        setError(result.error.message || "Failed to resend code")
      }
    } catch (err) {
      console.error("[auth-page] Resend exception:", err)
      setError("Failed to resend code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    setStep("email")
    setOtp("")
    setError("")
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-black/70 px-8 py-10 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
          <header className="space-y-2 text-left">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/40">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Welcome to Linsa!
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">
              {step === "email" ? "Any Generation. Instantly." : "Enter your code"}
            </h1>
            <p className="text-sm text-white/70">
              {step === "email"
                ? "Text, images/video on canvas. Fancy context management. Just think it and it's there."
                : `We sent a 6-digit code to ${email}`}
            </p>
          </header>

          {step === "email" ? (
            <form onSubmit={handleSendOTP} className="mt-8 space-y-5">
              <div className="space-y-2 text-left">
                <p className="text-sm font-medium text-white">
                  Enter your email and we'll send you a verification code.
                </p>
              </div>

              <label className="block text-left text-xs font-semibold uppercase tracking-wide text-white/60">
                Email
                <input
                  ref={emailInputRef}
                  type="email"
                  placeholder="you@gmail.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-0"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Sending code..." : "Send verification code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="mt-8 space-y-5">
              <label className="block text-left text-xs font-semibold uppercase tracking-wide text-white/60">
                Verification Code
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
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-0"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Verifying..." : "Sign in"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-white/60 hover:text-white transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-white/60 hover:text-white transition disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              Coming soon
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed"
              >
                <Apple className="h-4 w-4" aria-hidden="true" />
                Apple
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed"
              >
                <ChromeIcon className="h-4 w-4" />
                Google
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
