# Production Setup (Cloudflare Workers)

This app deploys two Workers:
- `@linsa/web`: SSR app + API routes + Electric proxy
- `@linsa/worker`: standalone API bound in `@linsa/web` as `WORKER_RPC`

The stack expects Postgres over HTTP (Neon or a Postgres behind a Neon HTTP proxy) and ElectricSQL for sync.

## Prerequisites
- Cloudflare account with Workers enabled and `wrangler` logged in
- Production Postgres reachable over HTTP (Neon recommended, or a Postgres behind a Neon HTTP proxy)
- Electric Cloud account (or self-hosted Electric instance)
- Domain for cookies (`APP_BASE_URL`)
- OpenRouter API key (optional, for AI responses)

## 1) Database (Postgres)
- Create a Neon database (recommended) and copy the `postgresql://...neon.tech/...` connection string.
- Ensure logical replication (`wal_level=logical`) is enabled. Neon enables it by default; for other Postgres, enable it and allow replication access.
- Electric needs replication on these tables: `users`, `sessions`, `accounts`, `verifications`, `chat_threads`, `chat_messages`.
- If not using Neon, expose your Postgres through a Neon HTTP proxy; Cloudflare Workers cannot talk to raw TCP Postgres.

## 2) Electric Cloud / Self-hosted Electric
1. Sign up at [Electric Cloud](https://electric-sql.com/product/cloud) or point to your own Electric instance.
2. Create a source connected to your Postgres.
3. Note:
   - `ELECTRIC_URL` – Electric endpoint (shape API)
   - `ELECTRIC_SOURCE_ID` and `ELECTRIC_SOURCE_SECRET` – only if Electric Cloud auth is enabled

## 3) Cloudflare Worker configuration
- Optional: rename the `name` fields in `packages/worker/wrangler.jsonc` and `packages/web/wrangler.jsonc`. If you rename the worker, also update `services[0].service` in `packages/web/wrangler.jsonc` so the `WORKER_RPC` binding still points to the right script.
- Set secrets for `@linsa/web` (run inside `packages/web`):
```bash
cd packages/web

wrangler secret put DATABASE_URL        # Neon/Postgres HTTP URL
wrangler secret put BETTER_AUTH_SECRET  # generate with: openssl rand -hex 32
wrangler secret put ELECTRIC_URL        # e.g., https://your-electric-host/v1/shape
wrangler secret put ELECTRIC_SOURCE_ID      # only if Electric Cloud auth is on
wrangler secret put ELECTRIC_SOURCE_SECRET  # only if Electric Cloud auth is on
wrangler secret put OPENROUTER_API_KEY      # optional, for real AI replies
wrangler secret put JAZZ_SPOTIFY_STATE_ID   # optional, for Spotify now playing
```
- Set non-secret vars:
```bash
wrangler vars set APP_BASE_URL https://your-domain.com        # exact origin for cookies
wrangler vars set OPENROUTER_MODEL anthropic/claude-sonnet-4  # optional override
```
- Prefer `pnpm` wrappers if you want to stay in the monorepo context:
```bash
pnpm --filter @linsa/web exec wrangler whoami
```
You can also run `f deploy-setup` from the repo root for an interactive secret setup.

## 4) Deploy
From the repo root:
```bash
pnpm deploy:worker   # deploy @linsa/worker
pnpm deploy:web      # build + deploy @linsa/web
# or
pnpm deploy          # deploy both
# Flow shortcut
f deploy
```

## 5) Verify
1. Open your production URL and confirm auth flows (sign up / sign in).
2. Create a chat thread/message; check Electric sync across two tabs.
3. Hit `/api/chat/ai` to confirm OpenRouter responses (or expect the demo reply when no key is set).
4. Tail logs if needed: `pnpm --filter @linsa/web exec wrangler tail`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres URL reachable over HTTP (Neon or Postgres behind Neon proxy) |
| `BETTER_AUTH_SECRET` | Yes | Secret for auth/session signing (32+ chars) |
| `ELECTRIC_URL` | Yes | Electric Cloud/self-host URL (shape endpoint) |
| `ELECTRIC_SOURCE_ID` | Conditional | Needed when Electric Cloud auth is enabled |
| `ELECTRIC_SOURCE_SECRET` | Conditional | Needed with `ELECTRIC_SOURCE_ID` |
| `APP_BASE_URL` | Yes | Production origin for cookies/CORS (e.g., https://app.example.com) |
| `OPENROUTER_API_KEY` | No | Enables real AI responses |
| `OPENROUTER_MODEL` | No | AI model id (default: `anthropic/claude-sonnet-4`) |
| `JAZZ_SPOTIFY_STATE_ID` | No | Jazz Spotify state id (from `x/server`) for now playing proxy |

## Troubleshooting
- Auth: `APP_BASE_URL` must match your deployed origin; rotate `BETTER_AUTH_SECRET` only when you intend to invalidate sessions.
- Database: use an HTTP-capable connection string; ensure logical replication is on and tables exist; allow Cloudflare egress to the DB host.
- Electric: confirm the source is healthy and credentials are set; verify `where` filters in logs if shapes look empty.
- AI chat: set `OPENROUTER_API_KEY`; without it you’ll see the demo reply instead of model output.
