import { createFileRoute, Link } from "@tanstack/react-router"
import { ShaderBackground } from "@/components/ShaderBackground"

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <ShaderBackground />

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-6xl font-bold tracking-tight drop-shadow-2xl">
          Linsa
        </h1>
        <p className="mt-4 text-xl text-white/80 drop-shadow-lg">
          Save anything. Share, sell or collaborate. Privately.
        </p>
        <Link
          to="/auth"
          className="mt-8 rounded-full bg-white px-8 py-3 text-lg font-semibold text-black transition-all hover:bg-white/90 hover:scale-105"
        >
          Sign up
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <a
            href="https://x.com/linsa_io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            @linsa_io
          </a>
          <span className="text-white/30">·</span>
          <a
            href="https://github.com/linsa-io/linsa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Open Source
          </a>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: LandingPage,
})
