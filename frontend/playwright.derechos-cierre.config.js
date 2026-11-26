import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Caller owns a new isolated backend, production bundle and synthetic manifests.
const baseURL = process.env.SALUD_CIERRE_BASE_URL;
if (!baseURL) throw new Error("SALUD_CIERRE_BASE_URL must identify the isolated closure environment.");
const target = new URL(baseURL);
if (!["127.0.0.1", "localhost"].includes(target.hostname)
    || !target.port || ["5197", "8235", "8231", "5179", "5194", "54697"].includes(target.port)) {
  throw new Error("A dedicated loopback port, never a protected manual environment, is required.");
}
for (const name of ["SALUD_NOVEDADES_MANIFEST", "SALUD_DERECHOS_CONJUNTO_MANIFEST",
  "SALUD_CONSULTA_MANIFEST", "SALUD_DERECHOS_PYTHON", "SALUD_TEST_POSTGRES_URL"]) {
  if (!process.env[name]) throw new Error(`${name} is required; use fresh synthetic data only.`);
}
process.env.SALUD_DERECHOS_MANUAL = "1";
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["derechos-operativos-real.spec.js",
    "consulta-prestacion-real.spec.js"],
  workers: 1, fullyParallel: false, retries: 0, timeout: 120000,
  expect: { timeout: 15000 }, reporter: "list",
  outputDir: join(tmpdir(), "salud-cierre-real-results"),
  use: { baseURL, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires",
    trace: "off", video: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
