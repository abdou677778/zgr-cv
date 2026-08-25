import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const autonomousBuild = process.env.ZGR_AUTONOMOUS_BUILD === "1";
const buildId = process.env.VITE_ZGR_BUILD_ID?.trim() || "local";

export default defineConfig({
  // Relative assets keep the same build usable from a GitHub Pages project
  // sub-path, a local folder, or a custom domain.
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  define: {
    "import.meta.env.VITE_ZGR_BUILD_ID": JSON.stringify(buildId),
  },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        codeSplitting: !autonomousBuild,
      },
    },
  },
});
