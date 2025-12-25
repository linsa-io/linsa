declare namespace Cloudflare {
  interface Env {
    DATABASE_URL: string
    HYPERDRIVE: Hyperdrive
    ELECTRIC_URL: string
    ELECTRIC_SOURCE_ID?: string
    ELECTRIC_SOURCE_SECRET?: string
    BETTER_AUTH_SECRET: string
    APP_BASE_URL?: string
    RESEND_API_KEY?: string
    RESEND_FROM_EMAIL?: string
    OPENROUTER_API_KEY?: string
    OPENROUTER_MODEL?: string
    GEMINI_API_KEY?: string
    FLOWGLAD_SECRET_KEY?: string
    CLOUDFLARE_STREAM_NIKIV_VIDEO_ID?: string
  }
}

interface Hyperdrive {
  connectionString: string
}

interface ImportMetaEnv {
  readonly VITE_FLOWGLAD_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
