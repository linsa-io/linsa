import { Hono } from "hono"
import { cors } from "hono/cors"

// Create a new Hono app
const app = new Hono()

// Enable CORS for all routes
app.use("/*", cors())

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", message: "Worker is running!" })
})

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Welcome to the Cloudflare Worker API",
    endpoints: {
      health: "/health",
      api: "/api/v1",
    },
  })
})

// Example API endpoint
app.get("/api/v1/hello", (c) => {
  const name = c.req.query("name") || "World"
  return c.json({ message: `Hello, ${name}!` })
})

// Export the Hono app as default (handles HTTP requests)
export default app

// Export the RPC worker for RPC calls via service bindings
export { WorkerRpc } from "./rpc"
