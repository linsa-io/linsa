export type CloudflareStreamRef = {
  uid: string
  customerCode?: string
}

export type StreamPlayback =
  | { type: "cloudflare"; uid: string; customerCode?: string }
  | { type: "webrtc"; url: string }
  | { type: "hls"; url: string }

type PlaybackInput = {
  hlsUrl?: string | null
  webrtcUrl?: string | null
  cloudflareUid?: string | null
  cloudflareCustomerCode?: string | null
}

export function resolveStreamPlayback({
  hlsUrl,
  webrtcUrl,
  cloudflareUid,
  cloudflareCustomerCode,
}: PlaybackInput): StreamPlayback | null {
  if (webrtcUrl) {
    return { type: "webrtc", url: webrtcUrl }
  }

  if (cloudflareUid) {
    return {
      type: "cloudflare",
      uid: cloudflareUid,
      customerCode: cloudflareCustomerCode ?? undefined,
    }
  }

  if (!hlsUrl) {
    return null
  }

  const cloudflare = parseCloudflareStreamUrl(hlsUrl)
  if (cloudflare) {
    return {
      type: "cloudflare",
      uid: cloudflare.uid,
      customerCode: cloudflare.customerCode,
    }
  }

  return { type: "hls", url: hlsUrl }
}

export function parseCloudflareStreamUrl(url: string): CloudflareStreamRef | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  const isCloudflareHost =
    host.endsWith(".cloudflarestream.com") ||
    host === "iframe.cloudflarestream.com" ||
    host.endsWith("videodelivery.net")

  if (!isCloudflareHost) {
    return null
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean)
  if (!pathParts.length) {
    return null
  }

  const uid = pathParts[0]
  if (!uid) {
    return null
  }

  const customerMatch = host.match(/^customer-([a-z0-9-]+)\.cloudflarestream\.com$/i)
  const customerCode = customerMatch?.[1]

  return { uid, customerCode }
}
