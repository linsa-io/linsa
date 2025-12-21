import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/i/1focus-demo")({
  beforeLoad: () => {
    throw redirect({
      href: "https://pub-43de6862e2764ff2970a4b87f1fc7578.r2.dev/1f-demo.mp4",
    })
  },
  component: () => null,
})
