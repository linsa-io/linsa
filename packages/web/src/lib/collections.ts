import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import {
  selectUsersSchema,
  selectChatThreadSchema,
  selectChatMessageSchema,
} from "@/db/schema"

export const usersCollection = createCollection(
  electricCollectionOptions({
    id: "users",
    shapeOptions: {
      url: new URL(
        "/api/users",
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000",
      ).toString(),
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
    },
    schema: selectUsersSchema,
    getKey: (item) => item.id,
  }),
)

const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000"

// Create collections lazily to avoid fetching before authentication
// Using a factory pattern so each call gets the same collection instance

const createChatThreadsCollection = () =>
  createCollection(
    electricCollectionOptions({
      id: "chat_threads",
      shapeOptions: {
        url: new URL("/api/chat-threads", baseUrl).toString(),
        parser: {
          timestamptz: (date: string) => new Date(date),
        },
        fetchClient: (input, init) =>
          fetch(input, { ...init, credentials: "include" }),
        onError: () => {
          // Silently ignore auth errors for guest users
        },
      },
      schema: selectChatThreadSchema,
      getKey: (item) => item.id,
    }),
  )

const createChatMessagesCollection = () =>
  createCollection(
    electricCollectionOptions({
      id: "chat_messages",
      shapeOptions: {
        url: new URL("/api/chat-messages", baseUrl).toString(),
        parser: {
          timestamptz: (date: string) => new Date(date),
        },
        fetchClient: (input, init) =>
          fetch(input, { ...init, credentials: "include" }),
        onError: () => {
          // Silently ignore auth errors for guest users
        },
      },
      schema: selectChatMessageSchema,
      getKey: (item) => item.id,
    }),
  )

type ChatThreadsCollection = ReturnType<typeof createChatThreadsCollection>
type ChatMessagesCollection = ReturnType<typeof createChatMessagesCollection>

let _chatThreadsCollection: ChatThreadsCollection | null = null
let _chatMessagesCollection: ChatMessagesCollection | null = null

export function getChatThreadsCollection(): ChatThreadsCollection {
  if (!_chatThreadsCollection) {
    _chatThreadsCollection = createChatThreadsCollection()
  }
  return _chatThreadsCollection
}

export function getChatMessagesCollection(): ChatMessagesCollection {
  if (!_chatMessagesCollection) {
    _chatMessagesCollection = createChatMessagesCollection()
  }
  return _chatMessagesCollection
}

// Keep exports for backward compatibility but as getters
export const chatThreadsCollection = {
  get collection() {
    return getChatThreadsCollection()
  },
}

export const chatMessagesCollection = {
  get collection() {
    return getChatMessagesCollection()
  },
}
