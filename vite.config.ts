/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Bastion Protocol — Vite + Vitest configuration.
// Vitest is configured here so pure-logic modules can be tested without a canvas.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
