import { useState, useEffect, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/login")({
  component: AuthPage,
  ssr: false,
})

type Step = "email" | "otp"

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

    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      if (error) {
        setError(error.message || "Failed to send code")
      } else {
        setStep("otp")
      }
    } catch (err) {
      console.error("Send OTP error:", err)
      setError("Failed to send verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return

    setIsLoading(true)
    setError("")

    try {
      // Use signIn.emailOtp for sign-in type OTPs (not verifyEmail which is for email verification)
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp,
      })

      if (error) {
        setError(error.message || "Invalid code")
      } else {
        window.location.href = "/"
      }
    } catch (err) {
      console.error("Verify OTP error:", err)
      setError("Failed to verify code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsLoading(true)
    setError("")
    setOtp("")

    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      if (error) {
        setError(error.message || "Failed to resend code")
      }
    } catch (err) {
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
    <div className="min-h-screen flex items-center justify-center bg-[#050505] py-12 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            {step === "email" ? "Sign in" : "Enter code"}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {step === "email"
              ? "Enter your email to receive a verification code"
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3 px-4 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050505] focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Sending..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label htmlFor="otp" className="sr-only">
                Verification code
              </label>
              <input
                ref={otpInputRef}
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-xl text-white text-center text-2xl tracking-widest font-mono placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="000000"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full py-3 px-4 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050505] focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Verifying..." : "Sign in"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleBack}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-neutral-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
