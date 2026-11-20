import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

async function setup(page, testInfo) {
  const manifest = JSON.parse(fs.readFileSync(process.env.SALUD_DERECHOS_CONJUNTO_MANIFEST, "utf8"));
  expect(manifest.purpose).toBe("salud-novedades-e2e");
  const data = manifest.manual;
  const response = await page.request.post("/api/auth/token/", { data: { email: data.operador, password: data.password } });
  expect(response.status()).toBe(200);
  const tokens = await response.json();
  await page.addInitScript(({ access, refresh }) => {
    sessionStorage.setItem("salud.access", access); sessionStorage.setItem("salud.refresh", refresh);
  }, tokens);
  return { org: data.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0],
    headers: { Authorization: `Bearer ${tokens.access}` } };
}
const route = (org, person) => `/financiadores/padron/${person}?financiador=${org}&tab=derechos`;
const postResponse = (page, suffix) => page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(suffix));

test("real embedded registration, reconciliation and decision refresh both modules", async ({ page }, info) => {
  const { org, headers } = await setup(page, info);
  const person = org.escenarios.decision.afiliado.id;
  await page.goto(route(org.id, person) + "&afiliado=999999");
  const panel = page.getByRole("tabpanel", { name: "Derechos", exact: true });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: "Buscar persona", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quitar filtro de persona" })).toHaveCount(0);
  await page.getByRole("button", { name: "Registrar novedad", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Persona del padrón", exact: true })).toHaveValue(String(person));
  await expect(page.getByRole("combobox", { name: "Persona del padrón", exact: true })).toBeDisabled();
  await page.getByLabel("Fuente", { exact: true }).fill("Aceptación conjunta automatizada");
  await page.getByLabel("Referencia externa").fill(randomUUID());
  await page.getByLabel("Descripción administrativa").fill("Evidencia sintética sin efectos automáticos.");
  await page.getByLabel("Motivo del registro").fill("Verificar ambos módulos con backend real.");
  const creation = postResponse(page, `/financiadores/${org.id}/novedades/`);
  await page.getByRole("button", { name: "Guardar propuesta" }).click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const novelty = await created.json();
  expect(novelty.original.afiliado).toBe(person);
  const dialog = page.getByRole("dialog", { name: `Novedad #${novelty.id}`, exact: true });
  await expect(dialog).toContainText("Evidencia: Pendiente");
  await dialog.getByLabel("Motivo de la decisión").fill("Revisión de evidencia sin cambio de cobertura.");
  const reconciliation = postResponse(page, `/novedades/${novelty.id}/resolver/`);
  await dialog.getByRole("button", { name: "Conciliar sin aplicar efectos" }).click();
  const reconciled = await (await reconciliation).json();
  expect(reconciled.efectos_aplicados).toBe(false);
  expect(reconciled.persona_actual.cobertura_habilitada).toBe(false);
  await expect(dialog).toContainText("Evidencia: Conciliada");
  await dialog.getByLabel("Estado de cobertura").selectOption("habilitar");
  await dialog.getByLabel("Motivo de la decisión").fill("Respaldo sintético confirmado para prueba.");
  const decision = postResponse(page, `/novedades/${novelty.id}/habilitacion-cobertura/`);
  await dialog.getByRole("button", { name: "Aplicar decisión de cobertura" }).click();
  expect((await decision).status()).toBe(200);
  await expect(dialog.getByRole("region", { name: "Decisión de cobertura", exact: true })).toContainText("Cobertura actualizada");
  // The response renders before the awaited query invalidations finish.
  await expect(dialog.getByRole("button", { name: "Cerrar", exact: true }).last()).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole("region", { name: "Situación de afiliación" })).toContainText("Habilitada");
  await expect(panel.getByRole("list", { name: "Novedades registradas" })).toContainText("Aplicada · Habilitada");
  await page.reload();
  await expect(panel).toBeVisible();
  const history = await page.request.get(`/api/financiadores/${org.id}/padron/${person}/historial/`, { headers });
  expect((await history.json()).results).toContainEqual(expect.objectContaining({ origen: "novedad", lote: novelty.id }));
  await page.getByRole("tab", { name: "Historial", exact: true }).click();
  await page.getByRole("link", { name: `Ver novedad #${novelty.id}`, exact: true }).click();
  await expect(page.getByRole("region", { name: "Evidencia original" })).toContainText("Evidencia sintética sin efectos automáticos.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("real no-op history and stale evidence remain distinct in affiliate rights", async ({ page }, info) => {
  const { org } = await setup(page, info);
  const unchanged = org.escenarios.sin_cambios;
  await page.goto(route(org.id, unchanged.afiliado.id));
  await expect(page.getByRole("list", { name: "Novedades registradas" })).toContainText("Sin cambios · Habilitada");
  await page.getByRole("button", { name: `Ver novedad ${unchanged.novedad}` }).click();
  await expect(page.getByRole("region", { name: "Decisión de cobertura", exact: true })).toContainText("Sin cambios: ya tenía el valor elegido");
  await expect(page.getByText(/Cambio enlazado al historial del padrón/)).toHaveCount(0);
  const conflict = org.escenarios.conflicto;
  await page.goto(route(org.id, conflict.afiliado.id) + `&novedad=${conflict.novedad}`);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo de la decisión").fill("Reconocer diferencia no autoriza cambio.");
  await dialog.getByRole("checkbox").check();
  const reconciliation = postResponse(page, `/novedades/${conflict.novedad}/resolver/`);
  await dialog.getByRole("button", { name: "Conciliar sin aplicar efectos" }).click();
  expect((await reconciliation).status()).toBe(200);
  await expect(dialog.getByRole("region", { name: "Siguiente paso" })).toContainText("El padrón cambió");
  await expect(dialog.getByRole("button", { name: "Aplicar decisión de cobertura" })).toHaveCount(0);
});
