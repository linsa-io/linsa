# Worker Package

A Cloudflare Worker that provides both HTTP API endpoints (via Hono) and RPC methods (via WorkerEntrypoint) for service bindings.

## Features

- **HTTP API**: REST endpoints using Hono framework
- **RPC Methods**: Type-safe RPC calls via WorkerEntrypoint for service bindings
- **CORS Support**: Pre-configured CORS for API endpoints
- **TypeScript**: Full type safety across the worker

## Project Structure

```
packages/worker/
├── src/
│   ├── index.ts       # Main entry point (exports HTTP handler and RPC class)
│   └── rpc.ts         # RPC methods (WorkerEntrypoint class)
├── wrangler.jsonc     # Cloudflare Worker configuration
├── tsconfig.json      # TypeScript configuration
├── vitest.config.mts  # Vitest configuration
└── package.json       # Package dependencies and scripts
```

## HTTP API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the worker.

**Response:**

```json
{
	"status": "ok",
	"message": "Worker is running!"
}
```

### Root

```
GET /
```

Returns information about available endpoints.

**Response:**

```json
{
	"message": "Welcome to the Cloudflare Worker API",
	"endpoints": {
		"health": "/health",
		"api": "/api/v1"
	}
}
```

### Hello Endpoint

```
GET /api/v1/hello?name=World
```

Returns a greeting message.

**Query Parameters:**

- `name` (optional): Name to greet (default: "World")

**Response:**

```json
{
	"message": "Hello, World!"
}
```

## Admin API (write access)

These endpoints write directly to Postgres for pragmatic data ingestion.

Authentication:
- If `ADMIN_API_KEY` is set, include `Authorization: Bearer <ADMIN_API_KEY>`.
- If `ADMIN_API_KEY` is not set, requests are allowed (useful for local dev).

### Canvas

- `POST /api/v1/admin/canvas`
- `PATCH /api/v1/admin/canvas/:canvasId`
- `POST /api/v1/admin/canvas/:canvasId/images`
- `PATCH /api/v1/admin/canvas/images/:imageId`
- `DELETE /api/v1/admin/canvas/images/:imageId`

### Chat

- `POST /api/v1/admin/chat/threads`
- `PATCH /api/v1/admin/chat/threads/:threadId`
- `POST /api/v1/admin/chat/messages`

### Context Items

- `POST /api/v1/admin/context-items`
- `PATCH /api/v1/admin/context-items/:itemId`
- `POST /api/v1/admin/context-items/:itemId/link`
- `DELETE /api/v1/admin/context-items/:itemId`

### Browser Sessions

- `POST /api/v1/admin/browser-sessions`
- `PATCH /api/v1/admin/browser-sessions/:sessionId`
- `DELETE /api/v1/admin/browser-sessions/:sessionId`

### External Logs

To forward logs into 1focus Logs for the `linsa` server, set these secrets/vars in the worker:

- `FOCUS_LOGS_API_KEY` (required)
- `FOCUS_LOGS_SERVER` (optional, default: `linsa`)
- `FOCUS_LOGS_ENDPOINT` (optional, default: `https://1focus.app/api/logs`)

Then send a log:

```bash
curl -X POST "http://localhost:8787/api/v1/admin/logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"message":"Hello from linsa","level":"info"}'
```

### Example (create chat thread)

```bash
curl -X POST "http://localhost:8787/api/v1/admin/chat/threads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"title":"Research notes","userId":"user_123"}'
```

## RPC Methods

The `WorkerRpc` class provides the following methods for service bindings:

### sayHello

```typescript
async sayHello(name: string): Promise<{ message: string; timestamp: number }>
```

Returns a greeting message with timestamp.

**Example:**

```typescript
const result = await env.WORKER_RPC.sayHello('World');
// { message: "Hello, World!", timestamp: 1234567890 }
```

### calculate

```typescript
async calculate(
  operation: 'add' | 'subtract' | 'multiply' | 'divide',
  a: number,
  b: number
): Promise<number>
```

Performs arithmetic operations.

**Example:**

```typescript
const sum = await env.WORKER_RPC.calculate('add', 5, 3);
// 8
```

### getData

```typescript
async getData(key: string): Promise<{ key: string; found: boolean; value?: string }>
```

Fetches data by key. Can be extended to use KV, D1, or R2 bindings.

**Example:**

```typescript
const result = await env.WORKER_RPC.getData('myKey');
// { key: "myKey", found: false, value: undefined }
```

### processBatch

```typescript
async processBatch(items: string[]): Promise<{ processed: number; items: string[] }>
```

Processes a batch of items.

**Example:**

```typescript
const result = await env.WORKER_RPC.processBatch(['item1', 'item2']);
// { processed: 2, items: ["ITEM1", "ITEM2"] }
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Start Development Server

```bash
pnpm dev
```

The worker will be available at http://localhost:8787

### Database configuration

Set `DATABASE_URL` locally or configure the `HYPERDRIVE` binding in `wrangler.jsonc`.
In production, use `wrangler secret put ADMIN_API_KEY` to secure the admin endpoints.

### Run Tests

```bash
pnpm test
```

### Linting

```bash
# Check for linting issues
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### Format Code

```bash
pnpm format
```

## Deployment

### Prerequisites

1. Install Wrangler CLI (included in dependencies)
2. Login to Cloudflare:

```bash
pnpm wrangler login
```

### Update Configuration

Edit `wrangler.jsonc` and update:

- `name`: Your worker name
- `account_id`: Your Cloudflare account ID (if needed)

### Deploy to Cloudflare

```bash
pnpm deploy
```

## Configuration

### wrangler.jsonc

Key configuration options:

```jsonc
{
	"name": "fullstack-monorepo-template-worker",
	"main": "src/index.ts",
	"compatibility_date": "2025-09-06",
}
```

### Adding Bindings

You can add various bindings to your worker:

#### KV Namespace

```jsonc
"kv_namespaces": [
  {
    "binding": "MY_KV",
    "id": "your-kv-namespace-id"
  }
]
```

#### D1 Database

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "my-database",
    "database_id": "your-database-id"
  }
]
```

#### R2 Bucket

```jsonc
"r2_buckets": [
  {
    "binding": "MY_BUCKET",
    "bucket_name": "my-bucket"
  }
]
```

#### Environment Variables

```jsonc
"vars": {
  "MY_VARIABLE": "production_value"
}
```

## Using RPC from Other Workers

To call this worker's RPC methods from another worker:

1. **Add a service binding in the calling worker's `wrangler.jsonc`:**

```jsonc
{
	"services": [
		{
			"binding": "WORKER_RPC",
			"service": "fullstack-monorepo-template-worker",
			"entrypoint": "WorkerRpc",
		},
	],
}
```

2. **Call RPC methods with full type safety:**

```typescript
export default {
	async fetch(request: Request, env: Env) {
		// Call RPC methods
		const greeting = await env.WORKER_RPC.sayHello('World');
		const sum = await env.WORKER_RPC.calculate('add', 5, 3);

		return new Response(JSON.stringify({ greeting, sum }));
	},
};
```

## Adding New Endpoints

### HTTP Endpoint

Add new routes in `src/index.ts`:

```typescript
app.get('/api/v1/users', (c) => {
	return c.json({ users: [] });
});
```

### RPC Method

Add new methods in `src/rpc.ts`:

```typescript
export class WorkerRpc extends WorkerEntrypoint {
	async getUser(userId: string): Promise<User> {
		// Your logic here
		return { id: userId, name: 'John Doe' };
	}
}
```

## Testing

Tests use Vitest with the Cloudflare Workers pool. Create test files alongside your source files:

```typescript
// src/index.test.ts
import { describe, it, expect } from 'vitest';

describe('Worker', () => {
	it('should return health status', async () => {
		const response = await fetch('http://localhost:8787/health');
		const data = await response.json();
		expect(data.status).toBe('ok');
	});
});
```

## TypeScript Types

The worker uses `@cloudflare/workers-types` for Cloudflare-specific types. These are automatically available in your TypeScript files.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (HTTP API)
- **RPC**: WorkerEntrypoint (Service Bindings)
- **Language**: TypeScript
- **Testing**: Vitest + @cloudflare/vitest-pool-workers
- **Package Manager**: pnpm

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev/)
- [Service Bindings (RPC)](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
