import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, "."), resolve(__dirname, "../../")]
    }
  },
  build: {
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, "overlay.html"),
        settings: resolve(__dirname, "settings.html"),
        setup: resolve(__dirname, "setup.html")
      }
    }
  }
});
