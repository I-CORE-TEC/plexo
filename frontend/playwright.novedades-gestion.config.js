import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolated UI tests: all API requests are intercepted, never the manual backend.
export default defineConfig({
  testDir: "./e2e", testMatch: "novedades-gestion-ui.spec.js", workers: 1,
  reporter: "list", timeout: 30000, expect: { timeout: 5000 },
  outputDir: join(tmpdir(), "salud-novedades-gestion-results"),
  use: { baseURL: "http://127.0.0.1:5195", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5195 --strictPort",
    env: { VITE_CACHE_DIR: join(tmpdir(), "salud-novedades-gestion-vite"), VITE_PROXY_TARGET: "http://127.0.0.1:1" },
    url: "http://127.0.0.1:5195", reuseExistingServer: false,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
});
