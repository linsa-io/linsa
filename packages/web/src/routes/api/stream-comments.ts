import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { db } from "@/db/connection"
import { stream_comments, users } from "@/db/schema"
import { eq } from "drizzle-orm"

export const Route = createFileRoute("/api/stream-comments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const username = url.searchParams.get("username")

        if (!username) {
          return new Response(JSON.stringify({ error: "username is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }

        try {
          const database = db()
          const comments = await database
            .select({
              id: stream_comments.id,
              user_id: stream_comments.user_id,
              user_name: users.name,
              user_email: users.email,
              content: stream_comments.content,
              created_at: stream_comments.created_at,
            })
            .from(stream_comments)
            .leftJoin(users, eq(stream_comments.user_id, users.id))
            .where(eq(stream_comments.stream_username, username))
            .orderBy(stream_comments.created_at)
            .limit(100)

          return new Response(JSON.stringify({ comments }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        } catch (err) {
          console.error("[stream-comments] GET error:", err)
          return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }
      },

      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({ headers: request.headers })
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        }

        try {
          const body = await request.json()
          const { username, content } = body as { username?: string; content?: string }

          if (!username || !content?.trim()) {
            return new Response(JSON.stringify({ error: "username and content are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            })
          }

          const database = db()
          const [newComment] = await database
            .insert(stream_comments)
            .values({
              stream_username: username,
              user_id: session.user.id,
              content: content.trim(),
            })
            .returning()

          // Get user info for response
          const [user] = await database
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1)

          return new Response(
            JSON.stringify({
              comment: {
                id: newComment.id,
                user_id: newComment.user_id,
                user_name: user?.name || "Anonymous",
                user_email: user?.email || "",
                content: newComment.content,
                created_at: newComment.created_at,
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }
          )
        } catch (err) {
          console.error("[stream-comments] POST error:", err)
          return new Response(JSON.stringify({ error: "Failed to post comment" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }
      },

      OPTIONS: () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        })
      },
    },
  },
})
