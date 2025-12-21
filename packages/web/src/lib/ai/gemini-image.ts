const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image-preview"

type GeminiEnv = {
  GEMINI_API_KEY?: string
  GOOGLE_API_KEY?: string
}

const getEnv = (): GeminiEnv => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: GeminiEnv } } | null
    }
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env) {
      const env = ctx.cloudflare.env
      if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
        return {
          GEMINI_API_KEY: env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY,
          GOOGLE_API_KEY: env.GOOGLE_API_KEY,
        }
      }
    }
  } catch {
    // ignore, running outside Cloudflare
  }

  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  return { GEMINI_API_KEY: key, GOOGLE_API_KEY: process.env.GOOGLE_API_KEY }
}

export type GeminiImageRequest = {
  prompt: string
  model?: string
  temperature?: number
}

export type GeminiImageResponse = {
  base64Image: string
  mimeType: string
  rawResponse: unknown
}

export async function generateGeminiImage(
  params: GeminiImageRequest,
): Promise<GeminiImageResponse> {
  const { GEMINI_API_KEY } = getEnv()

  if (!GEMINI_API_KEY) {
    throw new Error(
      "Set GEMINI_API_KEY or GOOGLE_API_KEY to enable Gemini image generation.",
    )
  }

  const model = params.model ?? DEFAULT_GEMINI_IMAGE_MODEL

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: params.prompt }],
      },
    ],
    generationConfig: {
      temperature: params.temperature ?? 0.9,
    },
  }

  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  })

  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof json?.error?.message === "string"
        ? json.error.message
        : "Gemini image generation failed"
    throw new Error(message)
  }

  const candidates = Array.isArray(json?.candidates) ? json.candidates : []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? []
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          base64Image: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
          rawResponse: json,
        }
      }
    }
  }

  throw new Error("Gemini did not return inline image data.")
}
