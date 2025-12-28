import React, { Suspense, Component, ReactNode } from "react"
import ReactDOM from "react-dom/client"
import { JazzReactProvider } from "jazz-tools/react"
import { AppAccount } from "../features/folders/model/schema"
import { App } from "./App"
import "./styles.css"

const container = document.getElementById("root")

if (!container) {
  throw new Error("Root container not found")
}

const apiKey = import.meta.env.VITE_JAZZ_API_KEY as string | undefined
const customPeer = import.meta.env.VITE_JAZZ_PEER as string | undefined
const peer = customPeer ?? (apiKey ? (`wss://cloud.jazz.tools/?key=${apiKey}` as const) : undefined)
const syncConfig = peer ? { peer } : { when: "never" as const }

// Loading state
function Loading() {
  return (
    <div className="app loading-screen">
      <div className="spinner" />
      <p>Connecting...</p>
    </div>
  )
}

// Error boundary for Jazz errors
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Jazz error:", error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app loading-screen">
          <h2 style={{ color: "#ef4444", marginBottom: 8 }}>Connection Error</h2>
          <p style={{ color: "#888", maxWidth: 400, textAlign: "center", marginBottom: 16 }}>
            {this.state.error.message}
          </p>
          <button
            className="primary-btn"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <JazzReactProvider
        AccountSchema={AppAccount}
        storage="indexedDB"
        defaultProfileName="Linsa Desktop"
        authSecretStorageKey="linsa-desktop-jazz"
        sync={syncConfig}
      >
        <Suspense fallback={<Loading />}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Suspense>
      </JazzReactProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
