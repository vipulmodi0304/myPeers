import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// In development the React app runs on :5173 and forwards API and socket
// traffic to the Express server on :4000, so the browser sees one origin
// (same as production, where Express serves the built app itself).
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "../dist/web"),
    emptyOutDir: true,
    // React + router + query is ~150 KB gzipped; signed-in pages are split out.
    chunkSizeWarningLimit: 550,
  },
});
