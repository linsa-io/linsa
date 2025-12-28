# Linsa API Documentation

This document describes the Linsa API endpoints and how to connect to them.

## Base URL

- **Local Development:** `http://localhost:5625`
- **Production:** `https://linsa.io` (or your deployed domain)

## Authentication

Linsa uses [better-auth](https://www.better-auth.com/) with email OTP for authentication.

### Authentication Flow

1. **Request OTP**: Send email to receive a one-time password
2. **Verify OTP**: Submit the code to authenticate
3. **Session Cookie**: A `better-auth.session_token` cookie is set on successful authentication

All authenticated endpoints require the session cookie to be included in requests.

### Auth Endpoints

All auth endpoints are handled by better-auth at `/api/auth/*`:

```
POST /api/auth/email-otp/send-verification-otp
POST /api/auth/email-otp/verify-otp
GET  /api/auth/session
POST /api/auth/sign-out
```

---

## API Key Authentication

For programmatic access (CLI tools, browser extensions), you can use API keys instead of session cookies.

### Create API Key

```http
POST /api/api-keys
Authorization: (session cookie required)
Content-Type: application/json

{
  "name": "My CLI Tool"
}
```

**Response:**
```json
{
  "key": "lk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "id": "uuid",
  "name": "My CLI Tool",
  "created_at": "2024-01-15T10:00:00Z"
}
```

> **Important:** The plain API key is only returned once on creation. Store it securely.

### List API Keys

```http
GET /api/api-keys
Authorization: (session cookie required)
```

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "My CLI Tool",
      "last_used_at": "2024-01-15T12:00:00Z",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Delete API Key

```http
DELETE /api/api-keys?id=<key_id>
Authorization: (session cookie required)
```

### Using API Keys

Pass the API key in the `X-API-Key` header or in the request body as `api_key`:

```http
GET /api/bookmarks
X-API-Key: lk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## User Profile

### Get Current User Profile

```http
GET /api/profile
Authorization: (session cookie required)
```

**Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "image": "https://...",
  "bio": "Developer and streamer",
  "website": "https://johndoe.com",
  "stream": {
    "id": "uuid",
    "title": "John's Stream",
    "is_live": false,
    "hls_url": "https://...",
    "webrtc_url": "https://...",
    "playback": { ... },
    "stream_key": "abc123..."
  }
}
```

### Update Profile

```http
PUT /api/profile
Authorization: (session cookie required)
Content-Type: application/json

{
  "name": "John Doe",
  "username": "johndoe",
  "image": "https://...",
  "bio": "Developer and streamer",
  "website": "https://johndoe.com"
}
```

**Username Requirements:**
- Minimum 3 characters
- Only lowercase letters, numbers, hyphens, and underscores
- Must be unique

---

## Streams

### Get Stream by Username (Public)

```http
GET /api/streams/{username}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "username": "johndoe",
    "image": "https://...",
    "bio": "Developer and streamer",
    "website": "https://johndoe.com",
    "location": "San Francisco",
    "joinedAt": "2024-01-01T00:00:00Z"
  },
  "stream": {
    "id": "uuid",
    "title": "Coding Session",
    "description": "Building cool stuff",
    "is_live": true,
    "viewer_count": 42,
    "hls_url": "https://...",
    "webrtc_url": "https://...",
    "playback": {
      "type": "cloudflare",
      "hlsUrl": "https://...",
      "webrtcUrl": "https://..."
    },
    "thumbnail_url": "https://...",
    "started_at": "2024-01-15T14:00:00Z"
  }
}
```

### Get Current User's Stream

```http
GET /api/stream
Authorization: (session cookie required)
```

### Update Stream

```http
PUT /api/stream
Authorization: (session cookie required)
Content-Type: application/json

{
  "title": "New Stream Title",
  "description": "Updated description",
  "hls_url": "https://...",
  "webrtc_url": "https://...",
  "is_live": true
}
```

### Stream Settings

```http
GET /api/stream/settings
Authorization: (session cookie required)
```

**Response:**
```json
{
  "id": "uuid",
  "title": "My Stream",
  "description": "Stream description",
  "cloudflare_live_input_uid": "...",
  "cloudflare_customer_code": "...",
  "hls_url": "https://...",
  "stream_key": "abc123..."
}
```

```http
PUT /api/stream/settings
Authorization: (session cookie required)
Content-Type: application/json

{
  "title": "My Stream",
  "description": "Stream description",
  "cloudflare_live_input_uid": "...",
  "cloudflare_customer_code": "..."
}
```

### Check HLS Stream Status

```http
GET /api/streams/{username}/check-hls
```

```http
GET /api/check-hls?url={hls_url}
```

---

## Stream Replays

### List Replays

```http
GET /api/stream-replays
Authorization: (session cookie required)
```

**Response:**
```json
{
  "replays": [
    {
      "id": "uuid",
      "stream_id": "uuid",
      "title": "Stream Replay",
      "description": "...",
      "status": "ready",
      "playback_url": "https://...",
      "thumbnail_url": "https://...",
      "started_at": "2024-01-15T14:00:00Z",
      "ended_at": "2024-01-15T16:00:00Z",
      "duration_seconds": 7200,
      "is_public": true
    }
  ]
}
```

### Create Replay

```http
POST /api/stream-replays
Authorization: (session cookie or X-Stream-Key header)
Content-Type: application/json

{
  "title": "My Replay",
  "description": "Description",
  "status": "processing",
  "playback_url": "https://...",
  "thumbnail_url": "https://...",
  "started_at": "2024-01-15T14:00:00Z",
  "ended_at": "2024-01-15T16:00:00Z",
  "is_public": true
}
```

**Status values:** `recording`, `processing`, `ready`, `failed`

### Get/Update/Delete Replay

```http
GET    /api/stream-replays/{replayId}
PUT    /api/stream-replays/{replayId}
DELETE /api/stream-replays/{replayId}
```

### Get Public Replays for User

```http
GET /api/streams/{username}/replays
```

---

## Bookmarks

API key authentication is required for bookmarks.

### Add Bookmark

```http
POST /api/bookmarks
Content-Type: application/json

{
  "api_key": "lk_xxx...",
  "url": "https://example.com/article",
  "title": "Interesting Article",
  "description": "A great read",
  "tags": ["tech", "programming"]
}
```

### List Bookmarks

```http
GET /api/bookmarks
X-API-Key: lk_xxx...
```

**Response:**
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "url": "https://example.com/article",
      "title": "Interesting Article",
      "description": "A great read",
      "tags": ["tech", "programming"],
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Browser Sessions

Save and sync browser tab sessions.

### List Sessions

```http
GET /api/browser-sessions?page=1&limit=50
Authorization: (session cookie required)
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "name": "Research Session",
      "browser": "safari",
      "tab_count": 15,
      "is_favorite": false,
      "captured_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### Save Session

```http
POST /api/browser-sessions
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "save",
  "name": "Research Session",
  "browser": "safari",
  "tabs": [
    {
      "title": "Page Title",
      "url": "https://example.com",
      "favicon_url": "https://example.com/favicon.ico"
    }
  ],
  "captured_at": "2024-01-15T10:00:00Z"
}
```

### Get Session with Tabs

```http
POST /api/browser-sessions
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "get",
  "session_id": "uuid"
}
```

### Update Session

```http
POST /api/browser-sessions
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "update",
  "session_id": "uuid",
  "name": "Updated Name",
  "is_favorite": true
}
```

### Delete Session

```http
POST /api/browser-sessions
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "delete",
  "session_id": "uuid"
}
```

### Search Tabs Across Sessions

```http
POST /api/browser-sessions
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "searchTabs",
  "query": "github",
  "limit": 100
}
```

---

## AI Chat

### Send Message (Streaming)

```http
POST /api/chat/ai
Authorization: (session cookie required)
Content-Type: application/json

{
  "threadId": 123,
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "model": "anthropic/claude-sonnet-4"
}
```

**Response:** Server-sent events stream with AI response chunks.

### Chat Mutations

```http
POST /api/chat/mutations
Authorization: (session cookie required)
Content-Type: application/json

{
  "action": "createThread" | "createMessage" | "deleteThread",
  ...
}
```

### Guest Chat

```http
POST /api/chat/guest
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

---

## Canvas (Collaborative Drawing)

### List Canvases

```http
GET /api/canvas
Authorization: (session cookie or guest cookie)
```

### Create Canvas

```http
POST /api/canvas
Authorization: (session cookie or guest cookie)
Content-Type: application/json

{
  "name": "My Canvas"
}
```

### Update Canvas

```http
PATCH /api/canvas
Authorization: (session cookie or guest cookie)
Content-Type: application/json

{
  "canvasId": "uuid",
  "name": "Updated Name",
  "width": 1920,
  "height": 1080,
  "defaultModel": "flux",
  "defaultStyle": "anime"
}
```

### Canvas Images

```http
GET  /api/canvas/images?canvasId={id}
POST /api/canvas/images
GET  /api/canvas/images/{imageId}
POST /api/canvas/images/{imageId}/generate
```

---

## Context Items (Knowledge Base)

### List Context Items

```http
GET /api/context-items
Authorization: (session cookie required)
```

### Create/Update Context Item

```http
POST /api/context-items
Authorization: (session cookie required)
Content-Type: application/json

{
  "url": "https://docs.example.com",
  "name": "API Docs"
}
```

---

## Archives

### List Archives

```http
GET /api/archives
Authorization: (session cookie required)
```

### Create Archive

```http
POST /api/archives
Authorization: (session cookie required)
Content-Type: application/json

{
  "url": "https://example.com/page",
  "title": "Page Title"
}
```

### Get/Delete Archive

```http
GET    /api/archives/{archiveId}
DELETE /api/archives/{archiveId}
```

---

## Electric SQL Sync

These endpoints proxy to Electric SQL for real-time data sync:

```http
GET /api/users              # Sync users table
GET /api/chat-threads       # Sync chat threads
GET /api/chat-messages      # Sync chat messages
GET /api/usage-events       # Sync usage events
```

---

## Billing (Flowglad)

When billing is enabled:

```http
GET  /api/flowglad/*        # Flowglad webhook handling
POST /api/stripe/checkout   # Create checkout session
POST /api/stripe/portal     # Customer portal
POST /api/stripe/webhooks   # Stripe webhooks
GET  /api/stripe/billing    # Billing status
```

### Creator Subscriptions

```http
GET  /api/creator/{username}/access  # Check access to creator content
POST /api/creator/subscribe          # Subscribe to creator
GET  /api/creator/tiers              # List subscription tiers
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - No permission |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limiting

AI chat endpoints have usage limits based on subscription tier. When limits are exceeded:

```json
{
  "error": "Usage limit exceeded",
  "reason": "monthly_limit",
  "remaining": 0,
  "limit": 100
}
```

---

## CORS

The API supports CORS for browser-based requests. Credentials (cookies) are allowed from trusted origins configured in the application.

---

## WebSocket / Real-time

For real-time features like chat and stream viewer counts, the application uses:

1. **Electric SQL** - For syncing database changes to clients
2. **Server-Sent Events (SSE)** - For AI chat streaming responses

---

## Example: Complete Authentication Flow

```bash
# 1. Request OTP
curl -X POST http://localhost:5625/api/auth/email-otp/send-verification-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Verify OTP (check terminal for code in dev mode)
curl -X POST http://localhost:5625/api/auth/email-otp/verify-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "otp": "123456"}'

# 3. Access authenticated endpoint
curl http://localhost:5625/api/profile \
  -b cookies.txt

# 4. Create API key for programmatic access
curl -X POST http://localhost:5625/api/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "My CLI Tool"}'

# 5. Use API key
curl http://localhost:5625/api/bookmarks \
  -H "X-API-Key: lk_xxxxxxxx..."
```

---

## Development Notes

- In development mode, OTP codes are logged to the terminal instead of being emailed
- The dev server runs on port 5625
- Database: PostgreSQL (Neon in production)
- Authentication: better-auth with email OTP plugin
