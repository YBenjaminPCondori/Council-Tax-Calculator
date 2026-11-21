import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "band-map/public",
  // Optimise the lazy export dependency up front so its first use does not reload the form in development.
  optimizeDeps: { include: ["docx"] },
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
