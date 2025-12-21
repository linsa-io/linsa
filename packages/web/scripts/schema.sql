-- PlanetScale Postgres Schema
-- Run this in PlanetScale's web console if API token doesn't have CREATE permissions

-- Better-auth tables (camelCase columns)
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "verifications" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

-- App tables (snake_case for Electric sync)
CREATE TABLE IF NOT EXISTS "chat_threads" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "title" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "thread_id" integer NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
  "role" varchar(32) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "canvas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL DEFAULT 'Untitled Canvas',
  "width" integer NOT NULL DEFAULT 1024,
  "height" integer NOT NULL DEFAULT 1024,
  "default_model" text NOT NULL DEFAULT 'gemini-2.0-flash-exp-image-generation',
  "default_style" text NOT NULL DEFAULT 'default',
  "background_prompt" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "canvas_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "canvas_id" uuid NOT NULL REFERENCES "canvas"("id") ON DELETE cascade,
  "name" text NOT NULL DEFAULT 'Untitled Image',
  "prompt" text NOT NULL DEFAULT '',
  "model_id" text NOT NULL DEFAULT 'gemini-2.0-flash-exp-image-generation',
  "model_used" text,
  "style_id" text NOT NULL DEFAULT 'default',
  "width" integer NOT NULL DEFAULT 512,
  "height" integer NOT NULL DEFAULT 512,
  "position" jsonb NOT NULL DEFAULT '{"x": 0, "y": 0}',
  "rotation" double precision NOT NULL DEFAULT 0,
  "content_base64" text,
  "image_url" text,
  "metadata" jsonb,
  "branch_parent_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "context_items" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" varchar(32) NOT NULL,
  "url" text,
  "name" text NOT NULL,
  "content" text,
  "refreshing" boolean NOT NULL DEFAULT false,
  "parent_id" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "thread_context_items" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "thread_id" integer NOT NULL REFERENCES "chat_threads"("id") ON DELETE cascade,
  "context_item_id" integer NOT NULL REFERENCES "context_items"("id") ON DELETE cascade,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
