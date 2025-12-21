/**
 * Example utilities for calling the Worker RPC from the web package
 *
 * Usage in server functions or loaders:
 *
 * import { getServerContext } from '@tanstack/react-start/server';
 * import { callWorkerRpc } from '@/lib/worker-rpc';
 *
 * export const loader = async () => {
 *   const { WORKER_RPC } = getServerContext().cloudflare.env;
 *   const result = await callWorkerRpc(WORKER_RPC);
 *   return result;
 * };
 */

import type { WorkerRpc } from "../../../worker/src/rpc"

/**
 * Example: Call the sayHello RPC method
 */
export async function sayHelloRpc(workerRpc: WorkerRpc, name: string) {
  return await workerRpc.sayHello(name)
}

/**
 * Example: Call the calculate RPC method
 */
export async function calculateRpc(
  workerRpc: WorkerRpc,
  operation: "add" | "subtract" | "multiply" | "divide",
  a: number,
  b: number,
) {
  return await workerRpc.calculate(operation, a, b)
}

/**
 * Example: Call the processBatch RPC method
 */
export async function processBatchRpc(workerRpc: WorkerRpc, items: string[]) {
  return await workerRpc.processBatch(items)
}

/**
 * Example: Call the getData RPC method
 */
export async function getDataRpc(workerRpc: WorkerRpc, key: string) {
  return await workerRpc.getData(key)
}
