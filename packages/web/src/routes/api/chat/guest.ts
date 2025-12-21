import { createFileRoute } from "@tanstack/react-router"
import { streamText } from "ai"
import { getOpenRouter, getDefaultModel } from "@/lib/ai/provider"
import { db } from "@/db/connection"
import { chat_threads, chat_messages } from "@/db/schema"

export const Route = createFileRoute("/api/chat/guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          messages?: Array<{ role: "user" | "assistant"; content: string }>
          model?: string
          threadId?: number
        }

        const messages = body.messages ?? []
        const model = body.model || getDefaultModel()

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "Missing messages" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          })
        }

        const database = db()
        let threadId = body.threadId

        // Create thread if not provided
        if (!threadId) {
          const lastUserMessage = messages.filter((m) => m.role === "user").pop()
          const title = lastUserMessage?.content?.slice(0, 40) || "New chat"
          const [thread] = await database
            .insert(chat_threads)
            .values({ title, user_id: null })
            .returning({ id: chat_threads.id })
          threadId = thread.id
        }

        // Save the user message
        const lastUserMessage = messages.filter((m) => m.role === "user").pop()
        if (lastUserMessage) {
          await database.insert(chat_messages).values({
            thread_id: threadId,
            role: "user",
            content: lastUserMessage.content,
          })
        }

        const openrouter = getOpenRouter()
        if (!openrouter) {
          const reply = `Demo reply: I received "${lastUserMessage?.content}". Configure OPENROUTER_API_KEY for real responses.`

          // Save assistant message
          await database.insert(chat_messages).values({
            thread_id: threadId,
            role: "assistant",
            content: reply,
          })

          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(JSON.stringify({ threadId }) + "\n"))
              controller.enqueue(encoder.encode(reply))
              controller.close()
            },
          })

          return new Response(stream, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        }

        try {
          const result = streamText({
            model: openrouter.chat(model),
            system: "You are a helpful assistant.",
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            async onFinish({ text }) {
              // Save assistant message when streaming completes
              await database.insert(chat_messages).values({
                thread_id: threadId!,
                role: "assistant",
                content: text,
              })
            },
          })

          // Return threadId in a custom header so client can track it
          const response = result.toTextStreamResponse()
          response.headers.set("X-Thread-Id", String(threadId))
          return response
        } catch (error) {
          console.error("[guest-ai] streamText error:", error)
          throw error
        }
      },
    },
  },
})
