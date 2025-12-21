import { useEffect, useMemo, useState, useRef } from "react"
import { Link } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { LogIn, Menu, X, LogOut } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
  getChatThreadsCollection,
  getChatMessagesCollection,
} from "@/lib/collections"
import ContextPanel from "@/components/Context-panel"
import { ChatInput, AVAILABLE_MODELS, type ModelId } from "./ChatInput"
import { EmptyChatState, MessageList } from "./ChatMessages"
import type { Message } from "./MessageBubble"

const MODEL_STORAGE_KEY = "gen_chat_model"
const FREE_REQUEST_LIMIT = 2

function getStoredModel(): ModelId {
  if (typeof window === "undefined") return AVAILABLE_MODELS[0].id
  const stored = localStorage.getItem(MODEL_STORAGE_KEY)
  if (stored && AVAILABLE_MODELS.some((m) => m.id === stored)) {
    return stored as ModelId
  }
  return AVAILABLE_MODELS[0].id
}

function setStoredModel(model: ModelId) {
  localStorage.setItem(MODEL_STORAGE_KEY, model)
}

async function createThread(title = "New chat") {
  const res = await fetch("/api/chat/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "createThread", title }),
  })
  if (!res.ok) throw new Error("Failed to create chat")
  const json = (await res.json()) as {
    thread: { id: number; title: string; created_at?: string }
  }
  return {
    ...json.thread,
    created_at: json.thread.created_at
      ? new Date(json.thread.created_at)
      : new Date(),
  }
}

async function addMessage({
  threadId,
  role,
  content,
}: {
  threadId: number
  role: "user" | "assistant"
  content: string
}) {
  const res = await fetch("/api/chat/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "addMessage",
      threadId,
      role,
      content,
    }),
  })
  if (!res.ok) throw new Error("Failed to add message")
  const json = (await res.json()) as {
    message: { id: number; thread_id: number; role: string; content: string; created_at?: string }
  }
  return {
    ...json.message,
    created_at: json.message.created_at
      ? new Date(json.message.created_at)
      : new Date(),
  }
}

type DBMessage = {
  id: number
  thread_id: number
  role: string
  content: string
  created_at: Date
}

type GuestMessage = {
  id: number
  role: "user" | "assistant"
  content: string
}

// Guest chat component - saves to database with null user_id
function GuestChat() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([])
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelId>(AVAILABLE_MODELS[0].id)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedModel(getStoredModel())
  }, [])

  const messages: Message[] = useMemo(() => {
    const msgs = guestMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }))
    // Add pending user message if streaming and not yet in guestMessages
    if (pendingUserMessage && !msgs.some((m) => m.role === "user" && m.content === pendingUserMessage)) {
      msgs.push({
        id: Date.now(),
        role: "user",
        content: pendingUserMessage,
      })
    }
    return msgs
  }, [guestMessages, pendingUserMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model)
    setStoredModel(model)
  }

  const userMessagesSent = guestMessages.filter((m) => m.role === "user").length
  const limitReached = userMessagesSent >= FREE_REQUEST_LIMIT

  const handleSubmit = async (userContent: string) => {
    if (!userContent.trim() || isStreaming || limitReached) return

    // Set pending message immediately so it shows while streaming
    setPendingUserMessage(userContent)
    setIsStreaming(true)
    setStreamingContent("")

    try {
      const newUserMsg: GuestMessage = {
        id: Date.now(),
        role: "user",
        content: userContent,
      }
      setGuestMessages((prev) => [...prev, newUserMsg])
      setPendingUserMessage(null) // Clear pending once added to guestMessages

      const apiMessages = [
        ...guestMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userContent },
      ]

      const res = await fetch("/api/chat/guest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, model: selectedModel, threadId }),
      })

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`)
      }

      // Get thread ID from response header
      const responseThreadId = res.headers.get("X-Thread-Id")
      if (responseThreadId && !threadId) {
        setThreadId(Number(responseThreadId))
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingContent(accumulated)
      }

      const newAssistantMsg: GuestMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: accumulated,
      }
      setGuestMessages((prev) => [...prev, newAssistantMsg])
      setStreamingContent("")

    } catch (error) {
      console.error("Chat error:", error)
      setStreamingContent("")
      setPendingUserMessage(null)
    } finally {
      setIsStreaming(false)
    }
  }

  const remainingRequests = Math.max(0, FREE_REQUEST_LIMIT - userMessagesSent)

  return (
    <>
      {/* Mobile header - only visible on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[#07080f]/95 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <Link
          to="/auth"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
        >
          <LogIn size={16} />
          <span>Sign in</span>
        </Link>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute top-0 left-0 h-full w-72 bg-[#0a0b10] border-r border-white/5 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <span className="text-white font-medium">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-4">
              <ContextPanel
                chats={[]}
                activeChatId={null}
                isAuthenticated={false}
                profile={null}
              />
            </div>
            <div className="p-4 border-t border-white/5">
              <Link
                to="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors"
              >
                <LogIn size={18} />
                <span>Sign in</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      <div className="min-h-screen max-w-[1700px] mx-auto md:grid md:grid-cols-[280px_1fr] bg-inherit">
        <aside className="hidden md:flex border-r flex-col w-full h-screen border-none">
          <ContextPanel
            chats={[]}
            activeChatId={null}
            isAuthenticated={false}
            profile={null}
          />
        </aside>
        <main className="flex flex-col h-screen bg-[#07080f] pt-14 md:pt-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
              {messages.length === 0 && !isStreaming ? (
                <EmptyChatState />
              ) : (
                <>
                  <MessageList
                    messages={messages}
                    streamingContent={streamingContent}
                    isStreaming={isStreaming}
                  />
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ChatInput
              onSubmit={handleSubmit}
              isLoading={isStreaming}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              remainingRequests={remainingRequests}
              limitReached={limitReached}
            />
          </div>
        </main>
      </div>
    </>
  )
}

// Authenticated chat component - uses Electric SQL
function AuthenticatedChat({ user }: { user: { name?: string | null; email: string; image?: string | null } }) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null)
  const [pendingMessages, setPendingMessages] = useState<Message[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>(AVAILABLE_MODELS[0].id)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  const chatThreadsCollection = getChatThreadsCollection()
  const chatMessagesCollection = getChatMessagesCollection()

  const { data: threads = [] } = useLiveQuery((q) =>
    q
      .from({ chatThreads: chatThreadsCollection })
      .orderBy(({ chatThreads }) => chatThreads.created_at),
  )

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.id - a.id),
    [threads],
  )

  useEffect(() => {
    if (activeThreadId === null && sortedThreads.length > 0) {
      setActiveThreadId(sortedThreads[0].id)
    }
  }, [sortedThreads, activeThreadId])

  const { data: dbMessages = [] } = useLiveQuery((q) => {
    const base = q
      .from({ chatMessages: chatMessagesCollection })
      .orderBy(({ chatMessages }) => chatMessages.created_at)
    if (activeThreadId === null) {
      return base.where(({ chatMessages }) => eq(chatMessages.thread_id, -1))
    }
    return base.where(({ chatMessages }) =>
      eq(chatMessages.thread_id, activeThreadId),
    )
  })

  useEffect(() => {
    if (pendingMessages.length === 0) return

    const stillPending = pendingMessages.filter((pending) => {
      const isSynced = dbMessages.some(
        (m: DBMessage) =>
          m.role === pending.role &&
          m.content === pending.content,
      )
      return !isSynced
    })

    if (stillPending.length !== pendingMessages.length) {
      setPendingMessages(stillPending)
    }
  }, [dbMessages, pendingMessages])

  useEffect(() => {
    setSelectedModel(getStoredModel())
  }, [])

  const messages: Message[] = useMemo(() => {
    const baseMessages: Message[] = dbMessages.map((m: DBMessage) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.created_at,
    }))

    const msgs = [...baseMessages]
    for (const pending of pendingMessages) {
      const alreadyExists = msgs.some(
        (m) => m.role === pending.role && m.content === pending.content,
      )
      if (!alreadyExists) {
        msgs.push(pending)
      }
    }

    return msgs
  }, [dbMessages, pendingMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model)
    setStoredModel(model)
  }

  const handleSubmit = async (userContent: string) => {
    if (!userContent.trim() || isStreaming) return

    setIsStreaming(true)
    setStreamingContent("")

    try {
      let threadId = activeThreadId
      if (!threadId) {
        const thread = await createThread(userContent.slice(0, 40) || "New chat")
        threadId = thread.id
        setActiveThreadId(thread.id)
      }

      const pendingUserMsg: Message = {
        id: Date.now(),
        role: "user",
        content: userContent,
        createdAt: new Date(),
      }
      setPendingMessages((prev) => [...prev, pendingUserMsg])

      await addMessage({ threadId, role: "user", content: userContent })

      const threadMessages = dbMessages.filter((m: DBMessage) => m.thread_id === threadId)
      const apiMessages = [
        ...threadMessages.map((m: DBMessage) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userContent },
      ]

      const res = await fetch("/api/chat/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ threadId, messages: apiMessages, model: selectedModel }),
      })

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingContent(accumulated)
      }

      if (accumulated) {
        const pendingAssistantMsg: Message = {
          id: Date.now() + 1,
          role: "assistant",
          content: accumulated,
          createdAt: new Date(),
        }
        setPendingMessages((prev) => [...prev, pendingAssistantMsg])
      }
      setStreamingContent("")
    } catch (error) {
      console.error("Chat error:", error)
      setStreamingContent("")
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <>
      {/* Mobile header - only visible on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[#07080f]/95 backdrop-blur-sm border-b border-white/5">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Sign out"
        >
          <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center">
            <span className="text-xs font-medium text-white">
              {user.email?.charAt(0).toUpperCase()}
            </span>
          </div>
        </button>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute top-0 left-0 h-full w-72 bg-[#0a0b10] border-r border-white/5 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <span className="text-white font-medium">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ContextPanel
                chats={sortedThreads}
                activeChatId={activeThreadId ? activeThreadId.toString() : null}
                isAuthenticated={true}
                profile={user}
              />
            </div>
            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-white/70 text-sm truncate">{user.email}</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleSignOut()
                }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="min-h-screen max-w-[1700px] mx-auto md:grid md:grid-cols-[280px_1fr] bg-inherit">
        <aside className="hidden md:flex border-r flex-col w-full h-screen border-none">
          <ContextPanel
            chats={sortedThreads}
            activeChatId={activeThreadId ? activeThreadId.toString() : null}
            isAuthenticated={true}
            profile={user}
          />
        </aside>
        <main className="flex flex-col h-screen bg-[#07080f] pt-14 md:pt-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
              {messages.length === 0 && !isStreaming ? (
                <EmptyChatState />
              ) : (
                <>
                  <MessageList
                    messages={messages}
                    streamingContent={streamingContent}
                    isStreaming={isStreaming}
                  />
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <ChatInput
              onSubmit={handleSubmit}
              isLoading={isStreaming}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
            />
          </div>
        </main>
      </div>
    </>
  )
}

export function ChatPage() {
  const { data: session, isPending } = authClient.useSession()
  const isAuthenticated = !!session?.user

  if (isPending) {
    return null
  }

  // Render different components based on auth state
  // This prevents Electric SQL collections from being initialized for guests
  return isAuthenticated ? <AuthenticatedChat user={session.user} /> : <GuestChat />
}
