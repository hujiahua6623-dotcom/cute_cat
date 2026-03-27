import { defineConfig } from "vite";

/** Dev: proxy REST to backend; browser calls `/api/v1/*` on the Vite origin. */
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
