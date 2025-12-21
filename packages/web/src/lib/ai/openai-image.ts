const OPENAI_API_URL = "https://api.openai.com/v1/images/generations"
const DEFAULT_OPENAI_MODEL = "gpt-image-1"

type OpenAIEnv = {
  OPENAI_API_KEY?: string
}

const getEnv = (): OpenAIEnv => {
  try {
    const { getServerContext } = require("@tanstack/react-start/server") as {
      getServerContext: () => { cloudflare?: { env?: OpenAIEnv } } | null
    }
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env?.OPENAI_API_KEY) {
      return { OPENAI_API_KEY: ctx.cloudflare.env.OPENAI_API_KEY }
    }
  } catch {
    // ignore — not running in server context
  }
  return { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
}

export type OpenAIImageRequest = {
  prompt: string
  model?: string
  size?: "1024x1024" | "1024x1792" | "1792x1024"
}

export type OpenAIImageResponse = {
  base64Image: string
  mimeType: string
  revisedPrompt?: string
}

export async function generateOpenAIImage(
  params: OpenAIImageRequest,
): Promise<OpenAIImageResponse> {
  const { OPENAI_API_KEY } = getEnv()
  if (!OPENAI_API_KEY) {
    throw new Error("Set OPENAI_API_KEY to enable DALL·E image generation.")
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model ?? DEFAULT_OPENAI_MODEL,
      prompt: params.prompt,
      size: params.size ?? "1024x1024",
      response_format: "b64_json",
    }),
  })

  const json: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof json?.error?.message === "string"
        ? json.error.message
        : "OpenAI image generation failed"
    throw new Error(message)
  }

  const payload = Array.isArray(json?.data) ? json.data[0] : undefined
  const base64 = typeof payload?.b64_json === "string" ? payload.b64_json : null
  if (!base64) {
    throw new Error("OpenAI returned no image data")
  }

  return {
    base64Image: base64,
    mimeType: "image/png",
    revisedPrompt: typeof payload?.revised_prompt === "string" ? payload.revised_prompt : undefined,
  }
}
