import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/canvas")({
  ssr: false,
  component: CanvasLayout,
})

function CanvasLayout() {
  return <Outlet />
}
