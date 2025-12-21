# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Architecture

This is a pnpm workspace monorepo with two packages:

- **`packages/worker`**: Cloudflare Worker (backend)
- **`packages/web`**: TanStack Start app (frontend)

### Key Architectural Pattern: Worker RPC via Service Bindings

The web package communicates with the worker package through **two mechanisms**:

1. **HTTP API** (traditional): REST endpoints exposed by Hono in `packages/worker/src/index.ts`
2. **RPC calls** (service bindings): Type-safe method calls via `WorkerRpc` class in `packages/worker/src/rpc.ts`

**Critical understanding**: The worker exports TWO things from `src/index.ts`:

- `export default app` - Hono HTTP handler (default export)
- `export { WorkerRpc } from './rpc'` - Named export for RPC entrypoint

The web package's `wrangler.jsonc` configures a service binding:

```jsonc
"services": [{
  "binding": "WORKER_RPC",
  "service": "fullstack-monorepo-template-worker",
  "entrypoint": "WorkerRpc"  // References the named export
}]
```

### Type Safety Across Packages

The web package imports types directly from the worker package:

```typescript
// packages/web/env.d.ts
import type { WorkerRpc } from '../worker/src/rpc';
```

This creates a **direct TypeScript dependency** between packages. The monorepo structure enables this cross-package type sharing.

### TanStack Start Server Context

In TanStack Start server functions/loaders, access the RPC binding via:

```typescript
import { getServerContext } from '@tanstack/react-start/server';

const { WORKER_RPC } = getServerContext().cloudflare.env;
const result = await WORKER_RPC.sayHello('World');
```

## Commands

### Development

```bash
# Run both services in separate terminals
pnpm dev:worker    # Worker on localhost:8787
pnpm dev:web       # Web on localhost:3000

# Or run just one
pnpm --filter @linsa/worker dev
pnpm --filter @linsa/web dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @linsa/worker test
pnpm --filter @linsa/web test

# Run tests in watch mode (within package directory)
cd packages/worker && pnpm test --watch
```

### Linting & Formatting

```bash
pnpm lint           # Lint all packages + check formatting
pnpm lint:fix       # Fix linting issues in all packages
pnpm format         # Format all code
pnpm format:check   # Check formatting without changes
```

### Deployment

```bash
# Deploy both packages
pnpm deploy

# Deploy individually
pnpm deploy:worker
pnpm deploy:web

# Login to Cloudflare first (one-time)
cd packages/worker && pnpm wrangler login
```

### Working with Workspace Packages

```bash
# Add dependency to specific package
pnpm --filter @linsa/worker add <package-name>
pnpm --filter @linsa/web add <package-name>

# Add dev dependency
pnpm --filter @linsa/worker add -D <package-name>
```

## Adding New RPC Methods

When adding RPC methods that the web package will call:

1. **Add method to `packages/worker/src/rpc.ts`**:

```typescript
export class WorkerRpc extends WorkerEntrypoint {
	async myNewMethod(param: string): Promise<Result> {
		// implementation
	}
}
```

2. **TypeScript will automatically provide types** in the web package because `env.d.ts` imports the `WorkerRpc` type

3. **Call from web package** in any server function:

```typescript
const { WORKER_RPC } = getServerContext().cloudflare.env;
const result = await WORKER_RPC.myNewMethod('value');
```

4. **Optional**: Add helper function in `packages/web/src/lib/worker-rpc.ts` for convenience

## Adding Cloudflare Bindings

To add KV, D1, R2, or other bindings to the worker:

1. Update `packages/worker/wrangler.jsonc`:

```jsonc
{
	"kv_namespaces": [
		{
			"binding": "MY_KV",
			"id": "your-namespace-id",
		},
	],
}
```

2. Update TypeScript types in `packages/worker/src/index.ts` or create a separate `env.ts`:

```typescript
interface Env {
	MY_KV: KVNamespace;
}
```

3. Access in RPC methods or HTTP handlers:

```typescript
// In rpc.ts
export class WorkerRpc extends WorkerEntrypoint<Env> {
	async getData(key: string) {
		return await this.env.MY_KV.get(key);
	}
}
```

## Vitest Configuration for Cloudflare Workers

The worker package uses `@cloudflare/vitest-pool-workers` for testing. The config pattern is:

```typescript
// vitest.config.mts
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		pool: '@cloudflare/vitest-pool-workers',
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
```

**Do not use** `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config` - it causes TypeScript module resolution issues.

## pnpm Workspace Configuration

The `pnpm-workspace.yaml` includes `onlyBuiltDependencies` for native dependencies:

```yaml
onlyBuiltDependencies:
  - esbuild
  - sharp
  - workerd
```

This ensures these packages are built correctly in the monorepo context.

## Package Naming Convention

Packages use the `@linsa/*` scope:

- `@linsa/worker`
- `@linsa/web`

When filtering commands, use these exact names: `pnpm --filter @linsa/worker <command>`

## ESLint Configuration

The project uses **ESLint v9** with the new flat config format (`eslint.config.js`).

Key points:

- Uses `@typescript-eslint/eslint-plugin` v8+ (compatible with ESLint 9)
- Configured for both TypeScript and TSX/JSX files
- The `no-undef` rule is disabled for TypeScript files (TypeScript handles this)
- Ignores: `node_modules/`, `dist/`, `.wrangler/`, `build/`

Both packages (`worker` and `web`) have `lint` and `lint:fix` scripts that use the shared root config.
