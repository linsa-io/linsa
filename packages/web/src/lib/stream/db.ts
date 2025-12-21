export type StreamPageData = {
  user: {
    id: string
    name: string
    username: string | null
    image: string | null
  }
  stream: {
    id: string
    title: string
    description: string | null
    is_live: boolean
    viewer_count: number
    hls_url: string | null
    thumbnail_url: string | null
    started_at: string | null
  } | null
}

export async function getStreamByUsername(
  username: string,
): Promise<StreamPageData | null> {
  const res = await fetch(`/api/streams/${username}`, {
    credentials: "include",
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error("Failed to fetch stream data")
  }

  return res.json()
}
