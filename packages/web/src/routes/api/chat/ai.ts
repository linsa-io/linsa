import { createFileRoute } from "@tanstack/react-router"
import { streamText } from "ai"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import {
  chat_messages,
  chat_threads,
  context_items,
  thread_context_items,
} from "@/db/schema"
import { getOpenRouter, getDefaultModel } from "@/lib/ai/provider"
import { eq, inArray } from "drizzle-orm"
import { checkUsageAllowed, recordUsage } from "@/lib/billing"

export const Route = createFileRoute("/api/chat/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        const body = (await request.json().catch(() => ({}))) as {
          threadId?: number | string
          messages?: Array<{ role: "user" | "assistant"; content: string }>
          model?: string
        }

        const threadId = Number(body.threadId)
        const messages = body.messages ?? []
        const model = body.model || getDefaultModel()

        if (!threadId || messages.length === 0) {
          return new Response(
            JSON.stringify({ error: "Missing threadId or messages" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          )
        }

        const database = db()

        // Verify thread ownership
        const [thread] = await database
          .select()
          .from(chat_threads)
          .where(eq(chat_threads.id, threadId))
          .limit(1)

        if (!thread || thread.user_id !== session.user.id) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          })
        }

        // Check usage limits
        const usageCheck = await checkUsageAllowed(request)
        if (!usageCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: "Usage limit exceeded",
              reason: usageCheck.reason,
              remaining: usageCheck.remaining,
              limit: usageCheck.limit,
            }),
            {
              status: 429,
              headers: { "content-type": "application/json" },
            },
          )
        }

        // Load context items linked to this thread
        const linkedItems = await database
          .select({ context_item_id: thread_context_items.context_item_id })
          .from(thread_context_items)
          .where(eq(thread_context_items.thread_id, threadId))

        let contextContent = ""
        if (linkedItems.length > 0) {
          const itemIds = linkedItems.map((l) => l.context_item_id)
          const items = await database
            .select()
            .from(context_items)
            .where(inArray(context_items.id, itemIds))

          // Build context content from website content
          const contextParts = items
            .filter((item) => item.content && !item.refreshing)
            .map((item) => {
              return `--- Content from ${item.name} (${item.url}) ---\n${item.content}\n--- End of ${item.name} ---`
            })

          if (contextParts.length > 0) {
            contextContent = contextParts.join("\n\n")
          }
        }

        const openrouter = getOpenRouter()
        console.log(
          "[ai] openrouter:",
          openrouter ? "configured" : "not configured",
        )
        console.log(
          "[ai] OPENROUTER_API_KEY set:",
          !!process.env.OPENROUTER_API_KEY,
        )
        if (!openrouter) {
          // Fallback to streaming-compatible demo response
          const lastUserMessage = messages
            .filter((m) => m.role === "user")
            .pop()
          const reply = `Demo reply: I received "${lastUserMessage?.content}". Configure OPENROUTER_API_KEY for real responses.`

          // Save the assistant message
          await database.insert(chat_messages).values({
            thread_id: threadId,
            role: "assistant",
            content: reply,
          })

          // Return a streaming-compatible response using AI SDK data stream format
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              // AI SDK data stream format: 0: for text chunks
              controller.enqueue(encoder.encode(`0:${JSON.stringify(reply)}\n`))
              controller.close()
            },
          })

          return new Response(stream, {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "x-vercel-ai-data-stream": "v1",
            },
          })
        }

        // Use AI SDK streaming with OpenRouter
        console.log("[ai] calling streamText with model:", model)
        console.log("[ai] context content length:", contextContent.length)

        // Build system prompt with context
        let systemPrompt = "You are a helpful assistant."
        if (contextContent) {
          systemPrompt = `You are a helpful assistant. You have access to the following context information that you should use to answer questions:\n\n${contextContent}\n\nUse the above context to help answer the user's questions when relevant.`
        }

        try {
          const result = streamText({
            model: openrouter.chat(model),
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            async onFinish({ text }) {
              console.log("[ai] onFinish, text length:", text.length)
              // Save the assistant message when streaming completes
              await database.insert(chat_messages).values({
                thread_id: threadId,
                role: "assistant",
                content: text,
              })
              // Record usage for paid users
              await recordUsage(request, 1, `chat-${threadId}-${Date.now()}`)
            },
          })

          console.log("[ai] returning stream response")
          // Return the streaming response (AI SDK v5 uses toTextStreamResponse)
          return result.toTextStreamResponse()
        } catch (error) {
          console.error("[ai] streamText error:", error)
          throw error
        }
      },
    },
  },
})
