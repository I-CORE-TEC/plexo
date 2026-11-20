import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Dedicated real-backend environment; never reuse the existing manual servers.
if (!process.env.SALUD_NOVEDADES_MANIFEST || !process.env.SALUD_DERECHOS_CONJUNTO_MANIFEST || !process.env.SALUD_TEST_POSTGRES_URL) {
  throw new Error("Explicit isolated PostgreSQL and synthetic verification manifest required.");
}
const database = new URL(process.env.SALUD_TEST_POSTGRES_URL);
if (database.hostname !== "127.0.0.1" || database.port !== "54701"
    || database.pathname !== "/salud_financiadores_test") {
  throw new Error("Joint verification requires its dedicated loopback PostgreSQL on 54701.");
}
const python = process.env.SALUD_DERECHOS_PYTHON;
if (!python) throw new Error("SALUD_DERECHOS_PYTHON must identify the isolated runner.");
process.env.SALUD_DERECHOS_MANUAL = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["novedades-real.spec.js", "derechos-operativos-real.spec.js", "derechos-conjunto-real.spec.js"],
  workers: 1, fullyParallel: false, retries: 0, timeout: 120000,
  expect: { timeout: 15000 }, reporter: "list",
  outputDir: join(tmpdir(), "salud-derechos-conjunto-results"),
  use: { baseURL: "http://127.0.0.1:5197", locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires",
    trace: "off", video: "off", screenshot: "only-on-failure" },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: [
    { command: `"${python}" -B manage.py runserver 127.0.0.1:8235 --noreload`, cwd: "../backend",
      env: { DJANGO_SETTINGS_MODULE: "config.settings_financiadores_postgres_test", DJANGO_DEBUG: "true", PYTHON_DOTENV_DISABLED: "1" },
      url: "http://127.0.0.1:8235/api/health/", reuseExistingServer: false, timeout: 60000 },
    { command: "npm run dev -- --host 127.0.0.1 --port 5197 --strictPort",
      env: { VITE_PROXY_TARGET: "http://127.0.0.1:8235", VITE_CACHE_DIR: join(tmpdir(), "salud-derechos-conjunto-vite") },
      url: "http://127.0.0.1:5197", reuseExistingServer: false, timeout: 60000 },
  ],
});
