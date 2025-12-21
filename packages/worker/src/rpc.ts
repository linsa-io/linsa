import { WorkerEntrypoint } from "cloudflare:workers"

/**
 * RPC Worker Entrypoint
 * This class enables RPC-style calls to the worker from service bindings.
 * Methods defined here can be called directly from other workers or systems
 * that have a service binding to this worker.
 */
export class WorkerRpc extends WorkerEntrypoint {
  /**
   * Example RPC method - returns a greeting message
   */
  async sayHello(
    name: string,
  ): Promise<{ message: string; timestamp: number }> {
    return {
      message: `Hello, ${name}!`,
      timestamp: Date.now(),
    }
  }

  /**
   * Example RPC method - performs a calculation
   */
  async calculate(
    operation: "add" | "subtract" | "multiply" | "divide",
    a: number,
    b: number,
  ): Promise<number> {
    switch (operation) {
      case "add":
        return a + b
      case "subtract":
        return a - b
      case "multiply":
        return a * b
      case "divide":
        if (b === 0) throw new Error("Division by zero")
        return a / b
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  /**
   * Example RPC method - fetches data (could interact with bindings)
   */
  async getData(
    key: string,
  ): Promise<{ key: string; found: boolean; value?: string }> {
    // Example: You could interact with KV, D1, R2, etc. here
    // For now, just return a mock response
    return {
      key,
      found: false,
      value: undefined,
    }
  }

  /**
   * Example RPC method - processes batch operations
   */
  async processBatch(
    items: string[],
  ): Promise<{ processed: number; items: string[] }> {
    const processed = items.map((item) => item.toUpperCase())
    return {
      processed: items.length,
      items: processed,
    }
  }
}

// Export the RPC worker as the default export
export default WorkerRpc
