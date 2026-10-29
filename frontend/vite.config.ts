import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { assetsDir: "ui" },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api/friends": { target: "http://127.0.0.1:18082" },
      "/api/games/fishing": { target: "http://127.0.0.1:18083" },
      "/api/games/cooking": { target: "http://127.0.0.1:18084" },
      "/api/games/park": { target: "http://127.0.0.1:18085" },
      "/api": { target: "http://127.0.0.1:18081" },
    },
  },
});
