import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Fix debug package ESM compatibility - use the CJS build
      debug: "debug",
    },
  },
  optimizeDeps: {
    exclude: ["@tanstack/start-server-core"],
  },
  ssr: {
    noExternal: ["zod"],
    optimizeDeps: {
      exclude: ["@tanstack/start-server-core"],
    },
  },
})

export default config
