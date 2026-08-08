import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  publicDir: "../static",
  server: {
    fs: {
      allow: [".."]
    },
    proxy: {
      "/api": "http://127.0.0.1:5000"
    }
  },
  build: {
    rollupOptions: {
      input: {
        operator: "index.html",
        viewer: "viewer.html"
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/renderer/test/setup.ts"]
  }
});
