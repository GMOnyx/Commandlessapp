import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name using ESM approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    // Custom alias resolver so the external landing page can keep using its own
    // "@/" imports that point to its local src directory.
    {
      name: "landing-external-alias",
      enforce: "pre",
      resolveId(source, importer) {
        if (!source.startsWith("@/")) return null;
        if (!importer) return null;
        const landingRoot = path.resolve(__dirname, "Commandless landing page 2", "src");
        // Only remap "@/" when the importing file lives inside the landing folder
        if (importer.startsWith(landingRoot)) {
          const resolved = path.resolve(landingRoot, source.slice(2));
          return resolved;
        }
        return null;
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
