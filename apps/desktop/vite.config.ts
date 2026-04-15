import { defineConfig } from "vitest/config";
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Electron loads index.html from file:// in production.
  // Relative asset paths prevent blank screens in packaged apps.
  base: "./",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "electron/services/__tests__/**/*.test.mjs"],
    exclude: ["e2e/**", "**/node_modules/**"]
  }
})
