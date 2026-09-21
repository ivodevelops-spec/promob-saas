import { defineConfig } from "vite";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: "/admin/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
