import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { test, expect } from "@playwright/test";

test.skip(!process.env.SALUD_CONSULTA_MANIFEST, "Requires a fresh isolated synthetic consultation manifest.");

function businessState() {
  const script = [
    "import django, json", "django.setup()",
    "from apps.casos.models import Caso",
    "from apps.finanzas.models import MovimientoDinero, ObligacionFinanciera",
    "from apps.financiadores.models import AfiliacionCaso, ReservaCobertura",
    "print(json.dumps([list(m.objects.order_by('pk').values()) for m in (Caso, AfiliacionCaso, ReservaCobertura, ObligacionFinanciera, MovimientoDinero)],default=str,sort_keys=True))",
  ].join("\n");
  const result = spawnSync(process.env.SALUD_DERECHOS_PYTHON || "python", ["-B", "-c", script],
    { cwd: "../backend", encoding: "utf8", env: process.env, timeout: 30000 });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

test("real consultation estimates coverage and displays approved partial payment without business writes", async ({ page, baseURL }, info) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  const manifest = JSON.parse(fs.readFileSync(process.env.SALUD_CONSULTA_MANIFEST, "utf8"));
  expect(manifest.purpose).toBe("salud-consulta-positive-e2e");
  const scenario = manifest.scenarios[info.project.name === "mobile-chromium" ? 1 : 0];
  const login = await page.request.post("/api/auth/token/", { data: { email: manifest.operator, password: manifest.password } });
  expect(login.status()).toBe(200);
  const tokens = await login.json();
  await page.addInitScript(({ access, refresh }) => {
    sessionStorage.setItem("salud.access", access); sessionStorage.setItem("salud.refresh", refresh);
  }, tokens);
  const before = businessState();
  await page.goto(`/financiadores/padron/${scenario.affiliate}?financiador=${scenario.org}&tab=derechos`);
  const launch = page.getByRole("button", { name: "Consultar prestación y pago", exact: true });
  await expect(launch).toBeVisible();
  await launch.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Consultar prestación y pago", exact: true });
  const selector = dialog.getByRole("combobox", { name: "Prestación y hospital" });
  await selector.fill("Synthetic");
  // The floating list is portalled to document.body, outside the dialog subtree.
  await expect(page.getByRole("option", { name: scenario.label, exact: true })).toBeVisible();
  await selector.press("ArrowDown");
  await selector.press("Enter");
  await expect(selector).toHaveValue(scenario.label);
  await dialog.getByRole("button", { name: "Simular", exact: true }).click();
  const result = dialog.getByRole("region", { name: "Resultado de simulación" });
  await expect(result).toContainText("Cobertura parcial estimada");
  for (const [label, amount] of [["Total estimado", "100,00"], ["Financiador estimado", "80,00"], ["Paciente estimado", "20,00"]]) {
    await expect(result.locator("div").filter({ has: page.getByText(label, { exact: true }) }).last()).toContainText(amount);
  }
  await dialog.getByRole("button", { name: "Pagos registrados", exact: true }).click();
  await expect(dialog).toContainText(`Cuenta #${scenario.account} · Pago parcial registrado`);
  for (const [label, amount] of [["Cargo original", "80,00"], ["Pagos netos aprobados", "30,00"], ["Saldo pendiente", "50,00"]]) {
    await expect(dialog.locator("div").filter({ has: page.getByText(label, { exact: true }) }).last()).toContainText(amount);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(businessState()).toBe(before);
});
