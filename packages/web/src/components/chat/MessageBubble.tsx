import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export type Message = {
  id: string | number
  role: "user" | "assistant"
  content: string
  createdAt?: Date
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="w-fit max-w-2xl rounded-xl px-4 py-2 bg-[#16171f] inner-shadow-xl outline-1 outline-neutral-100/12 text-white">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  // Assistant message with Markdown rendering
  return (
    <div className="max-w-3xl">
      <div className="prose prose-sm prose-invert max-w-none text-white">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => (
              <h1
                className="text-2xl font-bold mt-6 mb-4 text-white"
                {...props}
              />
            ),
            h2: ({ ...props }) => (
              <h2
                className="text-xl font-bold mt-5 mb-3 text-white"
                {...props}
              />
            ),
            h3: ({ ...props }) => (
              <h3
                className="text-lg font-semibold mt-4 mb-2 text-white"
                {...props}
              />
            ),
            p: ({ ...props }) => (
              <p className="mb-4 leading-relaxed text-neutral-200" {...props} />
            ),
            ul: ({ ...props }) => (
              <ul
                className="list-disc list-inside mb-4 space-y-1 text-neutral-200"
                {...props}
              />
            ),
            ol: ({ ...props }) => (
              <ol
                className="list-decimal list-inside mb-4 space-y-1 text-neutral-200"
                {...props}
              />
            ),
            li: ({ ...props }) => (
              <li className="ml-2 text-neutral-200" {...props} />
            ),
            code: ({ className, children, ...props }: any) => {
              const isInline = !className
              return isInline ? (
                <code
                  className="bg-[#1e1f28] px-1.5 py-0.5 rounded text-sm font-mono text-teal-300"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <code
                  className="block bg-[#1e1f28] p-3 rounded-lg overflow-x-auto text-sm font-mono my-4 text-neutral-200"
                  {...props}
                >
                  {children}
                </code>
              )
            },
            pre: ({ ...props }) => <pre className="my-4" {...props} />,
            blockquote: ({ ...props }) => (
              <blockquote
                className="border-l-4 border-teal-500/50 pl-4 italic my-4 text-neutral-400"
                {...props}
              />
            ),
            a: ({ ...props }) => (
              <a
                className="text-teal-400 hover:text-teal-300 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            strong: ({ ...props }) => (
              <strong className="font-semibold text-white" {...props} />
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
      <div
        className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"
        style={{ animationDelay: "0.2s" }}
      />
      <div
        className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  )
}

export function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="max-w-3xl">
      <div className="prose prose-sm prose-invert max-w-none text-white">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => (
              <h1
                className="text-2xl font-bold mt-6 mb-4 text-white"
                {...props}
              />
            ),
            h2: ({ ...props }) => (
              <h2
                className="text-xl font-bold mt-5 mb-3 text-white"
                {...props}
              />
            ),
            h3: ({ ...props }) => (
              <h3
                className="text-lg font-semibold mt-4 mb-2 text-white"
                {...props}
              />
            ),
            p: ({ ...props }) => (
              <p className="mb-4 leading-relaxed text-neutral-200" {...props} />
            ),
            ul: ({ ...props }) => (
              <ul
                className="list-disc list-inside mb-4 space-y-1 text-neutral-200"
                {...props}
              />
            ),
            ol: ({ ...props }) => (
              <ol
                className="list-decimal list-inside mb-4 space-y-1 text-neutral-200"
                {...props}
              />
            ),
            li: ({ ...props }) => (
              <li className="ml-2 text-neutral-200" {...props} />
            ),
            code: ({ className, children, ...props }: any) => {
              const isInline = !className
              return isInline ? (
                <code
                  className="bg-[#1e1f28] px-1.5 py-0.5 rounded text-sm font-mono text-teal-300"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <code
                  className="block bg-[#1e1f28] p-3 rounded-lg overflow-x-auto text-sm font-mono my-4 text-neutral-200"
                  {...props}
                >
                  {children}
                </code>
              )
            },
            pre: ({ ...props }) => <pre className="my-4" {...props} />,
            blockquote: ({ ...props }) => (
              <blockquote
                className="border-l-4 border-teal-500/50 pl-4 italic my-4 text-neutral-400"
                {...props}
              />
            ),
            a: ({ ...props }) => (
              <a
                className="text-teal-400 hover:text-teal-300 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            strong: ({ ...props }) => (
              <strong className="font-semibold text-white" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-teal-500/70 animate-pulse" />
      </div>
    </div>
  )
}
