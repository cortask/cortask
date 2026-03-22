import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    headers: {
      "X-Frame-Options": "SAMEORIGIN",
    },
    proxy: {
      "/api": "http://localhost:3777",
      "/ws": {
        target: "ws://localhost:3777",
        ws: true,
      },
    },
  },
});
