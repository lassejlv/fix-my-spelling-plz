import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: { content: "src/content.ts" },
    outDir: "dist",
    format: "iife",
    clean: true,
  },
  {
    entry: { background: "src/background.ts" },
    outDir: "dist",
    format: "iife",
    clean: false,
  },
]);
