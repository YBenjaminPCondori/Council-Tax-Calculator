import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "band-map/public",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/three/build/three.core.js")) return "three-core";
        },
      },
    },
  },
});
