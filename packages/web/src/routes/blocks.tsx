import { createFileRoute } from "@tanstack/react-router"
import BlockPage from "@/components/blocks/BlockPage"

export const Route = createFileRoute("/blocks")({
  ssr: false,
  component: BlockPage,
})
