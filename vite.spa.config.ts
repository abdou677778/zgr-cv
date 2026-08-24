import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative assets keep the same build usable from a GitHub Pages project
  // sub-path, a local folder, or a custom domain.
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    cssCodeSplit: false,
  },
});
