import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  // transformers.js (Whisper worker, docs/voice-input.md) brings its own
  // WebAssembly files; prebundling it breaks their paths in `npm run dev`.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
      },
    },
  },
});
