import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Public base path. Set BASE_PATH=/<repo-name>/ when building for GitHub Pages.
 * A trailing slash is added if missing.
 */
function resolveBase(): string {
  const raw = process.env.BASE_PATH?.trim();
  if (!raw) return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig({
  root: path.resolve(rootDir, "client"),
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "client/src"),
    },
  },
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true,
  },
});
