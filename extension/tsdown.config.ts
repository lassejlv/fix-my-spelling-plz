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
  {
    entry: { options: "src/options.ts" },
    outDir: "dist",
    format: "iife",
    clean: false,
  },
]);
