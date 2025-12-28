import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { emailOTP } from "better-auth/plugins"
import { Resend } from "resend"
import { authDb } from "@/db/connection"
import * as schema from "@/db/schema"

type AuthEnv = {
  BETTER_AUTH_SECRET: string
  APP_BASE_URL?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
}

// Helper to get Cloudflare env from server context
const getCloudflareEnv = (): Partial<AuthEnv> | undefined => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: Partial<AuthEnv> } } | null
    }
    return getServerContext()?.cloudflare?.env
  } catch {
    return undefined
  }
}

// Get env from Cloudflare context or process.env
const getEnv = (): AuthEnv => {
  let BETTER_AUTH_SECRET: string | undefined
  let APP_BASE_URL: string | undefined
  let RESEND_API_KEY: string | undefined
  let RESEND_FROM_EMAIL: string | undefined

  // Try Cloudflare Workers context first (production)
  const cfEnv = getCloudflareEnv()
  if (cfEnv) {
    BETTER_AUTH_SECRET = cfEnv.BETTER_AUTH_SECRET
    APP_BASE_URL = cfEnv.APP_BASE_URL
    RESEND_API_KEY = cfEnv.RESEND_API_KEY
    RESEND_FROM_EMAIL = cfEnv.RESEND_FROM_EMAIL
  }

  // Fall back to process.env (local dev)
  BETTER_AUTH_SECRET = BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET
  APP_BASE_URL = APP_BASE_URL ?? process.env.APP_BASE_URL
  RESEND_API_KEY = RESEND_API_KEY ?? process.env.RESEND_API_KEY
  RESEND_FROM_EMAIL = RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL

  if (!BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is not configured")
  }

  return {
    BETTER_AUTH_SECRET,
    APP_BASE_URL,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
  }
}

export const getAuth = () => {
  // Note: We create a fresh auth instance per request because Cloudflare Workers
  // doesn't allow sharing I/O objects (like DB connections) across requests
  const env = getEnv()
  const database = authDb()

  // Detect production: if APP_BASE_URL is set and not localhost, we're in production
  const isProduction =
    env.APP_BASE_URL && !env.APP_BASE_URL.includes("localhost")
  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
  const fromEmail = env.RESEND_FROM_EMAIL ?? "noreply@example.com"

  console.log("[auth] Config:", {
    isProduction,
    hasResendKey: !!env.RESEND_API_KEY,
    fromEmail,
    appBaseUrl: env.APP_BASE_URL,
  })

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      usePlural: true,
      schema,
    }),
    trustedOrigins: [env.APP_BASE_URL ?? "http://localhost:5625"],
    plugins: [
      tanstackStartCookies(),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          console.log("[auth] sendVerificationOTP called:", {
            email,
            isProduction,
            hasResend: !!resend,
          })

          if (!isProduction || !resend) {
            // In dev mode or if Resend not configured, log OTP to terminal
            console.log("\n" + "=".repeat(50))
            console.log(`🔐 OTP CODE for ${email}`)
            console.log(`   Code: ${otp}`)
            console.log("=".repeat(50) + "\n")
            return
          }

          // Send email via Resend in production
          console.log("[auth] Sending email via Resend to:", email)
          const { error, data } = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Your Linsa verification code",
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background-color: #050505; color: #ffffff;">
                  <h2 style="color: #ffffff; margin-bottom: 16px; font-weight: 600;">Your verification code</h2>
                  <p style="color: #a1a1aa; margin-bottom: 24px;">Enter this code to sign in to Linsa:</p>
                  <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; text-align: center;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff; font-family: monospace;">${otp}</span>
                  </div>
                  <p style="color: #71717a; font-size: 14px; margin-top: 24px;">This code expires in 5 minutes.</p>
                  <p style="color: #52525b; font-size: 12px; margin-top: 16px;">If you didn't request this code, you can safely ignore this email.</p>
                </div>
              `,
          })

          if (error) {
            console.error("[auth] Failed to send OTP email:", error)
            throw new Error("Failed to send verification email")
          }

          console.log("[auth] Email sent successfully:", data)
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
      }),
    ],
  })
}

// Lazy proxy that calls getAuth() on each access
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, prop) {
    return getAuth()[prop as keyof ReturnType<typeof betterAuth>]
  },
})
