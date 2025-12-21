import { createFileRoute } from "@tanstack/react-router"
import MarketplacePage from "@/components/blocks/MarketplacePage"

export const Route = createFileRoute("/marketplace")({
  ssr: false,
  component: MarketplacePage,
})
