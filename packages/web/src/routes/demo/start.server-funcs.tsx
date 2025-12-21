import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

const getCurrentServerTime = createServerFn({
  method: "GET",
}).handler(async () => await new Date().toISOString())

export const Route = createFileRoute("/demo/start/server-funcs")({
  component: Home,
  loader: async () => await getCurrentServerTime(),
})

function Home() {
  const originalTime = Route.useLoaderData()
  const [time, setTime] = useState(originalTime)

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white"
      style={{
        backgroundImage:
          "radial-gradient(50% 50% at 20% 60%, #23272a 0%, #18181b 50%, #000000 100%)",
      }}
    >
      <div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-2xl mb-4">Start Server Functions - Server Time</h1>
        <div className="flex flex-col gap-2">
          <div className="text-xl">Starting Time: {originalTime}</div>
          <div className="text-xl">Current Time: {time}</div>
          <button
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
            onClick={async () => setTime(await getCurrentServerTime())}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
