import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const base = process.env.VITE_BASE_PATH || "/";
if (!base.startsWith("/") || base.includes("..") || /[?#\\]/.test(base)) {
  throw new Error("VITE_BASE_PATH must be an absolute URL pathname.");
}

export default defineConfig({
  root: fileURLToPath(new URL("./pages", import.meta.url)),
  base: base.endsWith("/") ? base : base + "/",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/lib/client", replacement: fileURLToPath(new URL("./lib/pages-client.ts", import.meta.url)) },
      { find: "@", replacement: projectRoot },
    ],
  },
  css: { postcss: projectRoot },
  build: {
    outDir: fileURLToPath(new URL("./pages-dist", import.meta.url)),
    emptyOutDir: true,
  },
});
