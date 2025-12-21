/**
 * Environment bindings for the web worker
 * This extends the auto-generated worker-configuration.d.ts
 */

import type { WorkerRpc } from "../worker/src/rpc"

declare module "cloudflare:workers" {
  interface Env {
    // Service binding to the worker RPC
    WORKER_RPC: Service<WorkerRpc>
  }
}

// For compatibility with TanStack Start
declare global {
  interface CloudflareEnv extends Env {}
}

export {}
