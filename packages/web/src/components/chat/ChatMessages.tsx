import { Sparkles } from "lucide-react"
import {
  MessageBubble,
  TypingIndicator,
  StreamingMessage,
  type Message,
} from "./MessageBubble"

export function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 flex items-center justify-center mb-6 shadow-lg">
        <Sparkles className="w-8 h-8 text-teal-400" />
      </div>
      <h2 className="text-2xl font-semibold mb-3 text-white">How can I help?</h2>
      <p className="text-neutral-400 text-sm max-w-sm">
        Start a conversation below.
      </p>
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
}: MessageListProps) {
  return (
    <div className="space-y-6 pb-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isStreaming && streamingContent && (
        <StreamingMessage content={streamingContent} />
      )}
      {isStreaming && !streamingContent && <TypingIndicator />}
    </div>
  )
}
