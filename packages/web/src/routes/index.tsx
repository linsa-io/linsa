import { createFileRoute } from "@tanstack/react-router"
import { ShaderBackground } from "@/components/ShaderBackground"

const galleryItems = [
  { id: 1, image: "https://picsum.photos/seed/linsa1/400/600", title: "Nature" },
  { id: 2, image: "https://picsum.photos/seed/linsa2/400/600", title: "Urban" },
  { id: 3, image: "https://picsum.photos/seed/linsa3/400/600", title: "Abstract" },
  { id: 4, image: "https://picsum.photos/seed/linsa4/400/600", title: "Portrait" },
  { id: 5, image: "https://picsum.photos/seed/linsa5/400/600", title: "Landscape" },
  { id: 6, image: "https://picsum.photos/seed/linsa6/400/600", title: "Art" },
  { id: 7, image: "https://picsum.photos/seed/linsa7/400/600", title: "Design" },
  { id: 8, image: "https://picsum.photos/seed/linsa8/400/600", title: "Photo" },
]

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <ShaderBackground />

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center">
        <h1 className="text-6xl font-bold tracking-tight drop-shadow-2xl">
          Linsa
        </h1>
        <p className="mt-4 text-xl text-white/80 drop-shadow-lg">
          Save anything privately. Share it.
        </p>
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

      {/* Gallery Section */}
      <div className="relative z-10 px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-6 text-center text-2xl font-semibold text-white/90">
            Gallery
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-[2/3] overflow-hidden rounded-2xl bg-white/5 transition-all hover:bg-white/10"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: LandingPage,
})
