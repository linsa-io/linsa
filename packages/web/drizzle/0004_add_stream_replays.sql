CREATE TABLE "stream_replays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stream_id" uuid NOT NULL REFERENCES "streams"(id) ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  "title" text NOT NULL DEFAULT 'Stream Replay',
  "description" text,
  "status" varchar(32) NOT NULL DEFAULT 'processing',
  "jazz_replay_id" text,
  "playback_url" text,
  "thumbnail_url" text,
  "duration_seconds" integer,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "is_public" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
