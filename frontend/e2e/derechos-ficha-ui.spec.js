import { test, expect } from "@playwright/test";

const lista = (results) => ({ count: results.length, results, next: null });
async function escenario(page, rol = "operador") {
  const consultas = [];
  const persona = { id: 45, numero: "00045", documento: "90000045", nombre: "Persona Ficticia", desde: "2020-01-01", vigente: true, cobertura_habilitada: false, plan: 31 };
  const org = { id: 21, nombre: "Mutual Ficticia", rol, tipo: "mutual" };
  await page.addInitScript(() => { sessionStorage.setItem("salud.access", "token-ficticio-mock"); sessionStorage.setItem("salud.refresh", "refresh-ficticio-mock"); });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    consultas.push(url.pathname + url.search);
    let data = lista([]);
    if (url.pathname === "/api/usuarios/me/") data = { id: 9, nombre_completo: "Operador Ficticio", financiadores: [org], capacidades_por_institucion: {}, roles_por_institucion: {} };
    if (url.pathname === "/api/financiadores/") data = lista([org]);
    if (url.pathname.includes("/ficha-afiliado/")) {
      if (url.searchParams.get("afiliado") !== "45") return route.fulfill({ status: 404, json: { detail: "No encontrado" } });
      data = { ...lista([]), afiliado: persona, historial: [], resumen: {}, cupos: [] };
    }
    if (url.pathname.includes("/planes/")) data = lista([{ id: 31, nombre: "Base Ficticio" }]);
    if (url.pathname.endsWith("/padron/45/")) data = { ...persona, permisos: {} };
    if (url.pathname.endsWith("/padron/45/historial/")) data = lista([{ id: 7, tipo: "actualizacion", registrado: "2026-11-01T12:00:00Z", usuario_nombre: "Operador Ficticio", motivo: "Evidencia revisada", origen: "novedad", lote: 81, cambios: {} }]);
    return route.fulfill({ json: data });
  });
  return consultas;
}

const novedadesConsultadas = (consultas) => consultas.filter((url) => url.includes("/novedades/"));

test("Derechos integrado fija persona sin panel de novedades y limpia contexto al salir", async ({ page }) => {
  const consultas = await escenario(page);
  await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&afiliado=99&novedad=81&novedades_estado=pendiente");
  const panel = page.getByRole("tabpanel", { name: "Derechos", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("region", { name: "Situación de afiliación" })).toContainText("Persona Ficticia");
  await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Novedades", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Registrar novedad" })).toHaveCount(0);
  await expect(panel.getByRole("table", { name: "Novedades registradas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver novedades de esta persona" })).toHaveCount(0);
  const tab = page.getByRole("tab", { name: "Derechos", exact: true });
  await tab.focus(); await page.keyboard.press("Enter");
  await expect(tab).toBeFocused();
  await page.getByRole("tab", { name: "Historial", exact: true }).click();
  await page.getByRole("tab", { name: "Derechos", exact: true }).click();
  await page.reload();
  await expect(panel).toBeVisible();
  expect(novedadesConsultadas(consultas)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("auditor consulta sin acciones y una persona u organización ajena no expone datos", async ({ page }) => {
  const consultas = await escenario(page, "auditor");
  await page.goto("/financiadores/padron/45?financiador=21&tab=derechos");
  await expect(page.getByRole("tabpanel", { name: "Derechos", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toContainText("Persona Ficticia");
  await page.goto("/financiadores/padron/999?financiador=21&tab=derechos");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.goto("/financiadores/padron/45?financiador=22&tab=derechos");
  await expect(page.getByText("No tenés acceso al financiador seleccionado")).toBeVisible();
  expect(consultas.some((u) => u.startsWith("/api/financiadores/22/"))).toBe(false);
  expect(novedadesConsultadas(consultas)).toEqual([]);
});

test("enlace antiguo de Derechos conserva búsqueda y contexto por persona e ignora la novedad", async ({ page }) => {
  const consultas = await escenario(page);
  await page.goto("/financiadores/derechos?financiador=21&afiliado=45&novedad=81&estado=conciliada&page=2");
  await expect(page.getByRole("heading", { name: "Derechos por persona" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toContainText("Persona Ficticia");
  await expect(page.getByRole("button", { name: "Buscar persona", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(novedadesConsultadas(consultas)).toEqual([]);
});

test("enlaces viejos de Novedades redirigen al historial de la persona o al padrón", async ({ page }) => {
  const consultas = await escenario(page);
  await page.goto("/financiadores/novedades?financiador=21&afiliado=45&novedad=81&estado=conciliada");
  await expect(page).toHaveURL(/\/financiadores\/padron\/45\?financiador=21&tab=historial$/);
  await expect(page.getByRole("tab", { name: "Historial", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goto("/financiadores/novedades?financiador=21");
  await expect(page).toHaveURL(/\/financiadores\/padron\?financiador=21$/);
  expect(novedadesConsultadas(consultas)).toEqual([]);
});

test("el historial conserva registros de novedades como texto de sólo lectura", async ({ page }) => {
  await escenario(page);
  await page.goto("/financiadores/padron/45?financiador=21&tab=historial");
  const historia = page.getByRole("region", { name: "Historia administrativa" });
  await expect(historia).toContainText("Origen: Novedad del financiador · Novedad #81");
  await expect(historia.getByRole("link", { name: /Ver novedad/ })).toHaveCount(0);
});
