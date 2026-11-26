import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Padrón OSTEL del mes (#219) con API interceptada: no usa datos reales.
export default defineConfig({
  testDir: "./e2e", testMatch: "ostel-mensual-ui.spec.js", workers: 1,
  reporter: "list", timeout: 30000, expect: { timeout: 7000 },
  outputDir: join(tmpdir(), "salud-ostel-mensual-results"),
  use: { baseURL: "http://127.0.0.1:5195", screenshot: "only-on-failure", locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5195 --strictPort",
    env: { VITE_CACHE_DIR: join(tmpdir(), "salud-ostel-mensual-vite"), VITE_PROXY_TARGET: "http://127.0.0.1:1" },
    url: "http://127.0.0.1:5195", reuseExistingServer: false,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
});
