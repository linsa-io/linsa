import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/main/index.ts"),
        output: {
          entryFileNames: "[name].js",
        },
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, "src/preload/index.ts"),
        formats: ["cjs"],
        fileName: () => "index.js",
      },
      rollupOptions: {
        output: {
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    root: __dirname,
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        "@shared": resolve(__dirname, "src/shared"),
        "@renderer": resolve(__dirname, "src/renderer"),
      },
    },
    server: {
      port: 0,
      host: "127.0.0.1",
      strictPort: false,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
