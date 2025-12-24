export type StreamReplayRecord = {
  id: string
  stream_id: string
  user_id: string
  title: string
  description: string | null
  status: string
  jazz_replay_id: string | null
  playback_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  started_at: string | null
  ended_at: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export async function getStreamReplaysByUsername(
  username: string,
): Promise<StreamReplayRecord[]> {
  const response = await fetch(`/api/streams/${username}/replays`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Failed to load stream replays")
  }

  const data = (await response.json()) as { replays?: StreamReplayRecord[] }
  return data.replays ?? []
}

export async function getStreamReplay(
  replayId: string,
): Promise<StreamReplayRecord> {
  const response = await fetch(`/api/stream-replays/${replayId}`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error("Failed to load stream replay")
  }

  const data = (await response.json()) as { replay?: StreamReplayRecord }
  if (!data.replay) {
    throw new Error("Replay not found")
  }

  return data.replay
}
