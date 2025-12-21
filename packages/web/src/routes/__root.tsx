import * as React from "react"
import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { BillingProvider } from "@/components/BillingProvider"

import appCss from "../styles.css?url"

const SITE_URL = "https://linsa.io"
const SITE_NAME = "Linsa"
const SITE_TITLE = "Linsa – Save anything privately. Share it."
const SITE_DESCRIPTION = "Save anything privately. Share it."

function DevtoolsToggle() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use Ctrl+Shift+D to avoid conflicts with browser shortcuts
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setShow((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!show) return null
  return <TanStackRouterDevtools />
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">404</h1>
        <p className="text-slate-600 mb-4">Page not found</p>
        <Link to="/" className="text-slate-900 underline hover:no-underline">
          Go home
        </Link>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      {
        name: "keywords",
        content: "save, bookmarks, private, share, organize",
      },
      { name: "author", content: SITE_NAME },
      { name: "theme-color", content: "#03050a" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:creator", content: "@linaborisova" },
    ],
    links: [
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  component: () => (
    <BillingProvider>
      <Outlet />
      <DevtoolsToggle />
    </BillingProvider>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
