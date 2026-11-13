import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// API interceptada: no accede al entorno manual ni a sus datos.
export default defineConfig({
  testDir: "./e2e", testMatch: "derechos-ficha-ui.spec.js", workers: 1,
  reporter: "list", timeout: 30000, expect: { timeout: 5000 },
  outputDir: join(tmpdir(), "salud-derechos-ficha-results"),
  use: { baseURL: "http://127.0.0.1:5193", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5193 --strictPort",
    env: { VITE_CACHE_DIR: join(tmpdir(), "salud-derechos-ficha-vite"), VITE_PROXY_TARGET: "http://127.0.0.1:1" },
    url: "http://127.0.0.1:5193", reuseExistingServer: false,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
});
