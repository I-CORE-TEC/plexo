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

test("search keeps form mounted and results float without layout movement", async ({ page }) => {
  await scenario(page);
  let liberar;
  let pendiente = false;
  const espera = new Promise((resolve) => { liberar = resolve; });
  await page.route("**/api/financiadores/21/aranceles/**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("search") === "con") { pendiente = true; await espera; }
    await route.fulfill({ json: list([{ id: 13, prestacion: "Consulta", hospital: "Hospital ficticio", codigo: "CONS" }]) });
  });
  await page.goto(embedded);
  await page.getByRole("button", { name: "Consultar prestación y pago" }).click();
  const modal = page.getByRole("dialog", { name: "Consultar prestación y pago" });
  const fecha = modal.getByLabel("Fecha de la prestación");
  await expect(fecha).toBeVisible();
  await modal.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  const nodo = await fecha.elementHandle();
  const antes = await fecha.boundingBox();
  const alto = (await modal.boundingBox()).height;
  const buscador = modal.getByRole("textbox", { name: "Buscar prestación u hospital" })
    .or(modal.locator("input").and(modal.getByRole("combobox", { name: "Prestación y hospital" })));
  try {
    await buscador.fill("con");
    await expect.poll(() => pendiente).toBe(true);
    expect(await nodo.evaluate((el) => el.isConnected)).toBe(true);
    expect(Math.abs((await fecha.boundingBox()).y - antes.y)).toBeLessThan(1);
    expect(Math.abs((await modal.boundingBox()).height - alto)).toBeLessThan(1);
  } finally { liberar(); }
  const campo = modal.getByRole("combobox", { name: "Prestación y hospital" });
  await expect(campo).toHaveJSProperty("tagName", "INPUT");
  await expect(page.getByRole("option", { name: "Consulta · Hospital ficticio · CONS" })).toBeVisible();
  expect(Math.abs((await fecha.boundingBox()).y - antes.y)).toBeLessThan(1);
  await campo.press("ArrowDown"); await campo.press("Enter");
  await expect(campo).toHaveValue("Consulta · Hospital ficticio · CONS");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await campo.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await campo.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(modal).toBeVisible();
  await campo.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("search supports keyboard paging retry and outside dismissal", async ({ page }) => {
  await scenario(page);
  let errores = 0;
  const consultas = [];
  await page.route("**/api/financiadores/21/aranceles/**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    consultas.push(query.get("search"));
    if (query.get("search") === "error" && errores++ === 0) {
      return route.fulfill({ status: 503, json: { detail: "Catálogo no disponible" } });
    }
    const segunda = query.get("page") === "2";
    return route.fulfill({ json: { count: 2, next: segunda ? null : "http://never-follow.invalid/page",
      results: [{ id: segunda ? 14 : 13, prestacion: segunda ? "Especialista" : "Consulta", hospital: "Hospital", codigo: "C1" }] } });
  });
  await page.goto(embedded);
  await page.getByRole("button", { name: "Consultar prestación y pago", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Consultar prestación y pago" });
  const campo = modal.getByRole("combobox", { name: "Prestación y hospital" });
  const panel = page.locator("[data-selector-panel]");
  await campo.click();
  await expect(panel.getByRole("option")).toHaveCount(1);
  await campo.press("PageDown");
  await expect(panel.getByRole("option", { name: /Especialista/ })).toBeVisible();
  await campo.press("ArrowDown"); await campo.press("Enter");
  await expect(campo).toHaveValue("Especialista · Hospital · C1");
  await expect(campo).toBeFocused();
  await campo.fill("error");
  await expect(modal.getByRole("button", { name: "Simular", exact: true })).toBeDisabled();
  await expect(panel.getByRole("alert")).toBeVisible();
  await campo.press("Enter");
  await expect(panel.getByRole("option")).toHaveCount(1);
  expect(consultas.filter((q) => q === "error")).toHaveLength(2);
  await modal.getByText(/^Estimación con la afiliación y el plan actuales/).click();
  await expect(panel).toHaveCount(0);
  await expect(modal).toBeVisible();
  await campo.click(); await campo.press("Tab");
  await expect(panel).toHaveCount(0);
  await expect(modal.getByLabel("Fecha de la prestación")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("novelty prioritizes decision and collapses history", async ({ page }) => {
  await scenario(page, { historia: [{ accion: "registrar", usuario: 9, fecha: "2026-11-19T12:00:00Z", motivo: "Antecedente verificable" }] });
  await page.goto(embedded + "&novedad=81");
  const modal = page.getByRole("dialog", { name: "Novedad #81" });
  await expect(modal.getByRole("region", { name: "Resumen de la novedad" })).toBeVisible();
  await expect(modal.getByText("Antecedente verificable")).not.toBeVisible();
  const accion = modal.getByRole("button", { name: "Aplicar decisión de cobertura" });
  const evidencia = modal.getByRole("region", { name: "Evidencia original" });
  expect((await accion.boundingBox()).y).toBeLessThan((await evidencia.boundingBox()).y);
  const historial = modal.locator("summary").filter({ hasText: "Historial de decisiones" });
  await historial.focus(); await page.keyboard.press("Enter");
  await expect(modal.getByText("Antecedente verificable")).toBeVisible();
});

test("rights consultation keeps help collapsed and uses the affiliate table", async ({ page }) => {
  await scenario(page);
  await page.goto(embedded);
  await expect(page.getByRole("heading", { name: "Derechos por persona" })).toHaveCount(0);
  await expect(page.getByRole("note").filter({ hasText: "Registrar o conciliar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Borradores de derechos" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda: Situación de afiliación", exact: true }).click();
  await expect(page.getByRole("link", { name: "Borradores de derechos" })).toBeVisible();
  await expect(page.getByText("Registrar o conciliar evidencia no modifica el padrón, la vigencia ni los derechos.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("table", { name: "Novedades registradas" })).toBeVisible();
});

test("rights consultation separates estimates and recorded payments", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errores.push(message.text()); });
  await scenario(page);
  await page.route("**/api/financiadores/21/aranceles/**", (route) => route.fulfill({ json: list([{ id: 13, prestacion: "Consulta", hospital: "Hospital ficticio", codigo: "CONS" }]) }));
  let payload;
  await page.route("**/api/financiadores/21/simular-prestacion/", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { simulacion: true, estado: "parcial", importe_total: "100.00", importe_financiador: "80.00", importe_paciente: "20.00", comprobaciones: [{ codigo: "regla", estado: "cumple", detalle: "Cobertura configurada: 80%." }] } });
  });
  await page.goto(embedded);
  const abrir = page.getByRole("button", { name: "Consultar prestación y pago" });
  await abrir.focus(); await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog", { name: "Consultar prestación y pago" });
  await modal.getByRole("combobox", { name: "Prestación y hospital" }).click();
  await page.getByRole("option", { name: "Consulta · Hospital ficticio · CONS" }).click();
  await modal.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(modal.getByText("Cobertura configurada: 80%.")).toBeVisible();
  expect(payload.afiliado).toBe(45);
  expect(payload.prestacion).toBe(13);
  await modal.getByRole("button", { name: "Pagos registrados", exact: true }).click();
  await expect(modal.getByText("No hay prestaciones realizadas visibles para esta afiliación.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(abrir).toBeFocused();
  expect(errores).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("payment consultation distinguishes reductions and pending approval", async ({ page }) => {
  const posts = await scenario(page, {}, "auditor");
  await page.route("**/api/financiadores/21/ficha-afiliado/**", (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get("pagos") !== "true") return route.fallback();
    expect(q.get("afiliado")).toBe("45");
    expect(q.get("estado")).toBe("realizada");
    return route.fulfill({ json: list([{ id: 7, prestacion: "Consulta realizada", hospital: "Hospital ficticio", fecha: "2026-11-19", estado_cobro: "resuelta",
      pago_financiador: { cuentas: [{ id: 9, estado: "saldada", importe_original: "80.00", ajustes_aprobados: "-80.00", obligacion_actual: "0.00", registrado_neto: "0.00", pendiente: "0.00", saldo_a_devolver: "0.00", por_aprobar: "30.00", reintegros_por_aprobar: "0.00", ajustes_por_aprobar: "0.00" }] } }]) });
  });
  await page.goto(embedded);
  await page.getByRole("button", { name: "Consultar prestación y pago" }).click();
  const modal = page.getByRole("dialog", { name: "Consultar prestación y pago" });
  await modal.getByRole("button", { name: "Pagos registrados", exact: true }).click();
  await expect(modal.getByText("Cuenta #9 · Sin saldo pendiente")).toBeVisible();
  await expect(modal.getByText("Pagos netos aprobados", { exact: true }).locator("..")).toContainText("0,00");
  await expect(modal.getByText("Pagos por aprobar", { exact: true }).locator("..")).toContainText("30,00");
  expect(posts).toHaveLength(0);
});

test("consultation paginates retries and clears obsolete estimates", async ({ page }) => {
  await scenario(page);
  let intentos = 0;
  await page.route("**/api/financiadores/21/aranceles/**", (route) => {
    const segunda = new URL(route.request().url()).searchParams.get("page") === "2";
    return route.fulfill({ json: { count: 2, results: [{ id: segunda ? 14 : 13, prestacion: "Consulta", hospital: "Hospital", codigo: "CONS" }], next: segunda ? null : "http://invalid.example/page" } });
  });
  await page.route("**/api/financiadores/21/simular-prestacion/", (route) => {
    expect(route.request().postDataJSON().afiliado).toBe(45);
    intentos += 1;
    return intentos === 1 ? route.fulfill({ status: 503, json: { detail: "No disponible" } }) : route.fulfill({ json: {
      simulacion: true, estado: "pendiente_evaluacion", importe_total: null, importe_financiador: null, importe_paciente: null,
      comprobaciones: [{ codigo: "arancel", estado: "pendiente", detalle: "Falta arancel" }],
    } });
  });
  await page.goto(embedded);
  const abrir = page.getByRole("button", { name: "Consultar prestación y pago", exact: true });
  await abrir.click();
  const modal = page.getByRole("dialog", { name: "Consultar prestación y pago" });
  const servicio = modal.getByRole("combobox", { name: "Prestación y hospital" });
  await servicio.click();
  await page.getByRole("option", { name: "Consulta · Hospital · CONS" }).click();
  await servicio.click();
  await page.locator("[data-selector-panel]").getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(servicio).toHaveValue("");
  expect(intentos).toBe(0);
  await page.getByRole("option", { name: "Consulta · Hospital · CONS" }).click();
  await modal.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await modal.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(modal.getByText("Falta arancel")).toBeVisible();
  await expect(modal.getByText("No determinado", { exact: true })).toHaveCount(3);
  await modal.getByRole("spinbutton", { name: "Cantidad", exact: true }).fill("2");
  await expect(modal.getByRole("region", { name: "Resultado de simulación" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await abrir.click();
  await expect(servicio).toHaveValue("");
  await expect(modal.getByRole("spinbutton", { name: "Cantidad", exact: true })).toHaveValue("1");
  expect(intentos).toBe(2);
});

test("manual decision updates list and detail while preserving fixed person", async ({ page }) => {
  const posts = await scenario(page);
  await page.goto(embedded);
  await expect(page.getByRole("note").filter({ hasText: "Registrar o conciliar" })).toHaveCount(0);
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
  await expect(page.getByRole("table", { name: "Novedades registradas" })).toContainText("Aplicada · Habilitada");
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
