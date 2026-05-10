import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: true,
    // Playwright specs live in `e2e/` and run via `npm run test:e2e`. Excluding
    // the directory keeps Vitest from importing @playwright/test, which would
    // crash with "test.describe() is not expected here".
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
