import { createFileRoute, redirect } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import {
  chatThreadsCollection,
  chatMessagesCollection,
} from "@/lib/collections"
import { ChatPage } from "@/components/chat/ChatPage"

export const Route = createFileRoute("/chat")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data?.session) {
      throw redirect({ to: "/login" })
    }
  },
  loader: async () => {
    await Promise.all([
      chatThreadsCollection.preload(),
      chatMessagesCollection.preload(),
    ])
    return null
  },
  component: ChatPage,
})
