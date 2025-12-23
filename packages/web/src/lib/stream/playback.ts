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
  preferWebRtc?: boolean
}

export function resolveStreamPlayback({
  hlsUrl,
  webrtcUrl,
  cloudflareUid,
  cloudflareCustomerCode,
  preferWebRtc = true,
}: PlaybackInput): StreamPlayback | null {
  const cloudflare = resolveCloudflareStreamRef({
    hlsUrl,
    cloudflareUid,
    cloudflareCustomerCode,
  })

  const resolvedWebRtcUrl = preferWebRtc
    ? resolveWebRtcUrl({
        webrtcUrl,
        cloudflare,
      })
    : null

  if (resolvedWebRtcUrl) {
    return { type: "webrtc", url: resolvedWebRtcUrl }
  }

  if (cloudflare) {
    return {
      type: "cloudflare",
      uid: cloudflare.uid,
      customerCode: cloudflare.customerCode,
    }
  }

  if (!hlsUrl) {
    return null
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

type CloudflareResolveInput = {
  hlsUrl?: string | null
  cloudflareUid?: string | null
  cloudflareCustomerCode?: string | null
}

export function resolveCloudflareStreamRef({
  hlsUrl,
  cloudflareUid,
  cloudflareCustomerCode,
}: CloudflareResolveInput): CloudflareStreamRef | null {
  if (cloudflareUid) {
    return {
      uid: cloudflareUid,
      customerCode: cloudflareCustomerCode ?? undefined,
    }
  }

  if (!hlsUrl) {
    return null
  }

  return parseCloudflareStreamUrl(hlsUrl)
}

export function buildCloudflareWhepUrl(ref: CloudflareStreamRef): string {
  if (ref.customerCode) {
    return `https://customer-${ref.customerCode}.cloudflarestream.com/${ref.uid}/whep`
  }
  return `https://videodelivery.net/${ref.uid}/whep`
}

type WebRtcResolveInput = {
  webrtcUrl?: string | null
  cloudflare: CloudflareStreamRef | null
}

export function resolveWebRtcUrl({
  webrtcUrl,
  cloudflare,
}: WebRtcResolveInput): string | null {
  if (webrtcUrl) {
    return webrtcUrl
  }

  if (!cloudflare) {
    return null
  }

  return buildCloudflareWhepUrl(cloudflare)
}
