import { createFileRoute } from "@tanstack/react-router"
import { ShaderBackground } from "@/components/ShaderBackground"

function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black text-white">
      <ShaderBackground />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-6xl font-bold tracking-tight drop-shadow-2xl">
          Linsa
        </h1>
        <p className="mt-4 text-xl text-white/80 drop-shadow-lg">
          Save anything privately. Share it.
        </p>
        <p className="mt-8 text-sm text-white/50">Coming Soon</p>
        <a
          href="https://x.com/linsa_io"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 text-sm text-white/60 transition-colors hover:text-white"
        >
          @linsa_io
        </a>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: LandingPage,
})
