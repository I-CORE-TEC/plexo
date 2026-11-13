import { test, expect } from "@playwright/test";

const list = (results) => ({ count: results.length, results, next: null });
async function scenario(page, overrides = {}, role = "operador") {
  const person = { id: 45, numero: "45", documento: "90000045", nombre: "Persona Ficticia", revision: 1, cobertura_habilitada: false, vigente: true };
  const org = { id: 21, nombre: "Mutual Ficticia", rol: role, tipo: "mutual" };
  let novelty = { id: 81, estado: "conciliada", revision: 1, original: { afiliado: 45, fuente: "Fuente ficticia", referencia: "REF", descripcion: "Evidencia sintética" },
    persona_actual: person, persona_inicial: person, conflictos: [], coincidencias: [], rectificaciones: [], historia: [], habilitacion_cobertura: null, ...overrides };
  const posts = [];
  await page.addInitScript(() => sessionStorage.setItem("salud.access", "synthetic-mock-token"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = list([]);
    if (path === "/api/usuarios/me/") data = { id: 9, nombre_completo: "Operador Ficticio", financiadores: [org], capacidades_por_institucion: {}, roles_por_institucion: {} };
    if (path === "/api/financiadores/") data = list([org]);
    if (path.includes("/ficha-afiliado/")) data = { ...list([]), afiliado: person, historial: [], resumen: {}, cupos: [] };
    if (path.endsWith("/padron/45/")) data = { ...person, permisos: {} };
    if (path.endsWith("/novedades/")) data = list([novelty]);
    if (path.endsWith("/novedades/81/")) data = novelty;
    if (route.request().method() === "POST") {
      posts.push(route.request().postDataJSON());
      novelty = { ...novelty, habilitacion_cobertura: { resultado: "cambiada", cobertura_habilitada: true, motivo: "Respaldo verificado", registrado: "2026-11-13T12:00:00Z" } };
      data = novelty;
    }
    await route.fulfill({ json: data });
  });
  return posts;
}
const embedded = "/financiadores/padron/45?financiador=21&tab=derechos&afiliado=99";

test("manual decision updates list and detail while preserving fixed person", async ({ page }) => {
  const posts = await scenario(page);
  await page.goto(embedded);
  await expect(page.getByRole("note").filter({ hasText: "Registrar o conciliar" })).toBeVisible();
  await expect(page.getByText("Sin decisión registrada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar filtro de persona" })).toHaveCount(0);
  const open = page.getByRole("button", { name: "Ver novedad 81" });
  await open.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Siguiente paso" })).toContainText("decisión explícita");
  await page.getByRole("combobox", { name: "Estado de cobertura" }).selectOption("habilitar");
  await page.getByRole("textbox", { name: "Motivo de la decisión" }).fill("Respaldo verificado");
  await page.getByRole("button", { name: "Aplicar decisión de cobertura" }).click();
  await expect(page.getByRole("region", { name: "Decisión de cobertura" })).toContainText("Cobertura actualizada");
  await page.getByRole("button", { name: "Cerrar", exact: true }).first().click();
  await expect(page.getByRole("list", { name: "Novedades registradas" })).toContainText("Aplicada · Habilitada");
  expect(posts).toHaveLength(1);
  expect(posts[0].cobertura_habilitada).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [overrides, message] of [
  [{ conflictos: ["padron_modificado"], coincidencias: [] }, "El padrón cambió"],
  [{ conflictos: ["referencia_repetida"], coincidencias: [82] }, "referencia"],
  [{ rectificaciones: [82] }, "rectificada"],
]) test(`blocks coverage with guidance: ${message}`, async ({ page }) => {
  const posts = await scenario(page, overrides);
  await page.goto(embedded + "&novedad=81");
  await expect(page.getByRole("region", { name: "Siguiente paso" })).toContainText(message);
  await expect(page.getByRole("button", { name: "Aplicar decisión de cobertura" })).toHaveCount(0);
  expect(posts).toHaveLength(0);
});

test("global auditor can distinguish no-change history without write actions", async ({ page }) => {
  await scenario(page, { habilitacion_cobertura: { resultado: "sin_cambios", cobertura_habilitada: false } }, "auditor");
  await page.goto("/financiadores/novedades?financiador=21");
  await expect(page.getByRole("list", { name: "Novedades registradas" })).toContainText("Sin cambios · Deshabilitada");
  await page.getByRole("button", { name: "Ver novedad 81" }).click();
  await expect(page.getByRole("region", { name: "Siguiente paso" })).toContainText("historial");
  await expect(page.getByRole("button", { name: "Aplicar decisión de cobertura" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Registrar rectificación" })).toHaveCount(0);
});
