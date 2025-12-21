import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import "./styles.css"

export const getRouter = () =>
  createRouter({
    routeTree,
    defaultPreload: "viewport",
    scrollRestoration: true,
  })

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
