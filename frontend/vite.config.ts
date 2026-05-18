import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:18100",
      "/licenses": "http://127.0.0.1:18100",
      "/auth": "http://127.0.0.1:18100",
    }
  },
  preview: {
    host: true,
    port: 5173
  }
});
