import { defineConfig } from "vitest/config";
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "electron/services/__tests__/**/*.test.mjs"],
    exclude: ["e2e/**", "**/node_modules/**"]
  }
})
