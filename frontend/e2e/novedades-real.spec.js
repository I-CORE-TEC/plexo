import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.skip(!process.env.SALUD_NOVEDADES_MANIFEST, "Requiere fixture ficticia y servidores locales explícitos.");

async function iniciar(page, baseURL, rol = "operador") {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  const datos = JSON.parse(fs.readFileSync(process.env.SALUD_NOVEDADES_MANIFEST, "utf8"));
  expect(datos.purpose).toBe("salud-novedades-e2e");
  const respuesta = await page.request.post("/api/auth/token/", {
    data: { email: datos[rol], password: datos.password },
  });
  expect(respuesta.ok()).toBeTruthy();
  const sesion = await respuesta.json();
  await page.addInitScript(({ access, refresh }) => {
    sessionStorage.setItem("salud.access", access);
    sessionStorage.setItem("salud.refresh", refresh);
  }, sesion);
  return { ...datos, headers: { Authorization: `Bearer ${sesion.access}` } };
}

async function proponer(page, datos, org) {
  const respuesta = await page.request.post(`/api/financiadores/${org.id}/novedades/`, {
    headers: datos.headers, data: { clave: randomUUID(), afiliado: org.afiliado,
      fuente: "Fixture API ficticia", referencia: `FICTICIA-${randomUUID()}`, codigo: "ORIGINAL",
      descripcion: "Antecedente ficticio para el recorrido", motivo: "Preparación aislada del escenario" },
  });
  expect(respuesta.status()).toBe(201);
  return respuesta.json();
}

async function conciliarNovedad(page, datos, org, propuesta) {
  const resuelta = await page.request.post(`/api/financiadores/${org.id}/novedades/${propuesta.id}/resolver/`, {
    headers: datos.headers,
    data: { accion: "conciliar", motivo: "Conciliación sintética para navegación", revision: propuesta.revision,
      revision_padron: propuesta.persona_actual.revision, confirmar_conflictos: false },
  });
  expect(resuelta.status()).toBe(200);
  return resuelta.json();
}

async function aplicarCobertura(page, datos, org, propuesta) {
  const conciliada = await conciliarNovedad(page, datos, org, propuesta);
  const objetivo = !conciliada.persona_actual.cobertura_habilitada;
  const aplicada = await page.request.post(`/api/financiadores/${org.id}/novedades/${propuesta.id}/habilitacion-cobertura/`, {
    headers: datos.headers,
    data: { cobertura_habilitada: objetivo, motivo: "Cambio sintético para navegación", revision: conciliada.revision,
      revision_padron: conciliada.persona_actual.revision },
  });
  expect(aplicada.status()).toBe(200);
  const resultado = await aplicada.json();
  expect(resultado.habilitacion_cobertura.resultado).toBe("cambiada");
  expect(resultado.habilitacion_cobertura.cobertura_habilitada).toBe(objetivo);
  return resultado;
}

test("la ficha abre novedades de la persona y conserva filtros de lista en la URL", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  for (let index = 0; index < 25; index += 1) await proponer(page, datos, org);
  const propuesta = await proponer(page, datos, org);
  await conciliarNovedad(page, datos, org, propuesta);
  await page.goto(`/financiadores/padron/${org.afiliado}?financiador=${org.id}`);

  const enlace = page.getByRole("link", { name: "Ver novedades de esta persona", exact: true });
  await expect(enlace).toBeVisible();
  const solicitudFiltrada = page.waitForRequest((request) => request.method() === "GET"
    && request.url().includes(`/api/financiadores/${org.id}/novedades/?`)
    && new URL(request.url()).searchParams.get("afiliado") === String(org.afiliado));
  await enlace.click();
  const solicitud = await solicitudFiltrada;
  expect(new URL(solicitud.url()).searchParams.get("afiliado")).toBe(String(org.afiliado));
  expect(new URL(page.url()).searchParams.get("financiador")).toBe(String(org.id));
  expect(new URL(page.url()).searchParams.get("afiliado")).toBe(String(org.afiliado));
  await expect(page.getByRole("list", { name: "Novedades registradas" }).getByText(`#${propuesta.id}`)).toBeVisible();
  const estado = page.getByLabel("Estado de la novedad");
  await estado.selectOption("conciliada");
  await expect(page).toHaveURL(new RegExp(`estado=conciliada`));
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.reload();
  await expect(estado).toHaveValue("conciliada");
  await expect(page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true }).click();
  await expect(page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("novedad")).toBe(String(propuesta.id));
  await page.reload();
  await expect(page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).last().click();
  expect(new URL(page.url()).searchParams.has("novedad")).toBe(false);
  await page.goto(`/financiadores/novedades?financiador=${org.id}&afiliado=${org.afiliado}&page=2`);
  await expect(page.getByText("Página 2", { exact: false })).toBeVisible();
  await page.getByRole("navigation", { name: "Paginación de novedades" }).getByRole("button", { name: "Anterior" }).click();
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.goBack();
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  await page.getByRole("button", { name: "Quitar filtro de persona", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("afiliado")).toBe(false);
  expect(new URL(page.url()).searchParams.get("financiador")).toBe(String(org.id));
});

test("el historial navega al antecedente exacto y la decisión vuelve a ficha e historial", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const propuesta = await proponer(page, datos, org);
  const aplicada = await aplicarCobertura(page, datos, org, propuesta);
  const historia = await page.request.get(`/api/financiadores/${org.id}/padron/${org.afiliado}/historial/`, { headers: datos.headers });
  expect(historia.ok()).toBeTruthy();
  const evento = (await historia.json()).results.find((fila) => fila.lote === propuesta.id && fila.origen === "novedad");
  expect(evento).toBeTruthy();
  let escriturasDeNavegacion = 0;
  page.on("request", (request) => { if (request.method() === "POST") escriturasDeNavegacion += 1; });
  await page.goto(`/financiadores/padron/${org.afiliado}?financiador=${org.id}&tab=historial`);

  const fuente = page.getByRole("link", { name: `Ver novedad #${propuesta.id}`, exact: true });
  await expect(fuente).toBeVisible();
  await fuente.click();
  await expect(page).toHaveURL(new RegExp(`financiador=${org.id}.*afiliado=${org.afiliado}.*novedad=${propuesta.id}`));
  const dialogo = page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(aplicada.habilitacion_cobertura.motivo, { exact: true })).toBeVisible();
  await expect(dialogo.getByRole("link", { name: "Ver ficha actual", exact: true })).toBeVisible();
  await expect(dialogo.getByRole("link", { name: "Ver historial", exact: true })).toBeVisible();
  await dialogo.getByRole("link", { name: "Ver historial", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/financiadores/padron/${org.afiliado}\\?financiador=${org.id}.*tab=historial`));
  await expect(page.getByRole("tabpanel", { name: "Historial" }).getByRole("link", { name: `Ver novedad #${propuesta.id}`, exact: true })).toBeVisible();
  expect(escriturasDeNavegacion).toBe(0);
  expect(aplicada.efectos_aplicados).toBe(false);
});

test("atrás y adelante no trasladan el borrador de una decisión a otra novedad", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const propuestas = [];
  for (let index = 0; index < 2; index += 1) {
    const propuesta = await proponer(page, datos, org);
    propuestas.push(await conciliarNovedad(page, datos, org, propuesta));
  }
  let enviosDeCobertura = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/habilitacion-cobertura/")) enviosDeCobertura += 1;
  });

  await page.goto(`/financiadores/novedades?financiador=${org.id}`);
  const abrir = async (id) => {
    await page.getByRole("button", { name: `Ver novedad ${id}`, exact: true }).click();
    await expect(page.getByRole("dialog", { name: `Novedad #${id}`, exact: true })).toBeVisible();
  };
  await abrir(propuestas[0].id);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await abrir(propuestas[1].id);
  const detalleB = page.getByRole("dialog", { name: `Novedad #${propuestas[1].id}`, exact: true });
  await detalleB.getByLabel("Estado de cobertura").selectOption("deshabilitar");
  await detalleB.getByLabel("Motivo de la decisión").fill("Motivo exclusivo de la segunda novedad.");

  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  const detalleA = page.getByRole("dialog", { name: `Novedad #${propuestas[0].id}`, exact: true });
  await expect(detalleA).toBeVisible();
  await expect(detalleA.getByLabel("Estado de cobertura")).toHaveValue("");
  await expect(detalleA.getByLabel("Motivo de la decisión")).toHaveValue("");

  await page.goForward();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  const detalleBRestaurado = page.getByRole("dialog", { name: `Novedad #${propuestas[1].id}`, exact: true });
  await expect(detalleBRestaurado).toBeVisible();
  await expect(detalleBRestaurado.getByLabel("Estado de cobertura")).toHaveValue("");
  await expect(detalleBRestaurado.getByLabel("Motivo de la decisión")).toHaveValue("");
  expect(enviosDeCobertura).toBe(0);
});

test("identificadores inválidos o de otro financiador no exponen evidencia", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const ajena = datos.organizaciones[org === datos.organizaciones[0] ? 1 : 0];
  const extranjera = await proponer(page, datos, ajena);

  await page.goto(`/financiadores/novedades?financiador=${org.id}&afiliado=${org.afiliado}&novedad=abc`);
  await expect(page.getByRole("alert").getByText(/identificador inválido/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/financiadores/novedades?financiador=${org.id}&afiliado=${org.afiliado}&novedad=${extranjera.id}`);
  const detalle = page.getByRole("dialog", { name: `Novedad #${extranjera.id}`, exact: true });
  await expect(detalle.getByRole("alert")).toBeVisible();
  await expect(detalle.getByText("Antecedente ficticio para el recorrido", { exact: true })).toHaveCount(0);
});

test("una respuesta pendiente de otro financiador no reemplaza la lista actual", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const [orgA, orgB] = datos.organizaciones;
  const propuestaA = await proponer(page, datos, orgA);
  const propuestaB = await proponer(page, datos, orgB);
  let liberar;
  let interceptada;
  const solicitudA = new Promise((resolve) => { interceptada = resolve; });
  const espera = new Promise((resolve) => { liberar = resolve; });
  await page.route(`**/api/financiadores/${orgA.id}/novedades/?*`, async (route) => {
    const respuesta = await route.fetch();
    interceptada();
    await espera;
    await route.fulfill({ response: respuesta });
  });

  await page.goto(`/financiadores/novedades?financiador=${orgA.id}&afiliado=${orgA.afiliado}`);
  await solicitudA;
  await page.goto(`/financiadores/novedades?financiador=${orgB.id}&afiliado=${orgB.afiliado}`);
  await expect(page.getByRole("button", { name: `Ver novedad ${propuestaB.id}`, exact: true })).toBeVisible();
  liberar();
  await expect(page.getByRole("button", { name: `Ver novedad ${propuestaA.id}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Ver novedad ${propuestaB.id}`, exact: true })).toBeVisible();
});

test("snapshot histórico sin cobertura declara el valor como no registrado", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  await page.goto(`/financiadores/novedades?financiador=${org.id}&novedad=${org.legacy_novedad}`);
  const dialogo = page.getByRole("dialog", { name: `Novedad #${org.legacy_novedad}`, exact: true });
  const snapshot = page.locator("section").filter({ has: page.getByRole("heading", { name: "Al registrar", exact: true }) });
  await expect(dialogo).toBeVisible();
  await expect(snapshot.getByText("Cobertura: No registrado", { exact: true })).toBeVisible();
  await expect(snapshot.getByText(/Deshabilitada/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
});

test("recorrido real de registro y conciliación sin efectos", async ({ page, baseURL }, testInfo) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  await page.goto(`/financiadores/novedades?financiador=${org.id}`);
  await expect(page.getByRole("button", { name: "Registrar novedad", exact: true })).toBeVisible();
  const antes = await page.request.get(`/api/financiadores/${org.id}/padron/`, { headers: datos.headers });
  expect(antes.ok()).toBeTruthy();
  const huella = await antes.json();
  await page.getByRole("button", { name: "Registrar novedad", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Buscar persona por documento o nombre").fill(org.documento);
  await expect(dialogo.getByRole("option", { name: /PERSONA FICTICIA [AB]/ })).toBeAttached();
  await dialogo.getByRole("combobox", { name: "Persona del padrón", exact: true }).selectOption(String(org.afiliado));
  await dialogo.getByLabel("Fuente", { exact: true }).fill("Fuente de navegador ficticia");
  await dialogo.getByLabel("Referencia externa").fill(`FICTICIA-${testInfo.project.name}-${Date.now()}`);
  await dialogo.getByLabel("Código informado").fill("SIN-EFECTOS");
  await dialogo.getByLabel("Fecha informada", { exact: true }).fill("2030-01-02");
  await dialogo.getByLabel("Descripción administrativa").fill("Evidencia ficticia para revisión administrativa.");
  await dialogo.getByLabel("Motivo del registro").fill("Comprobar registro sin modificar derechos.");
  const creadaPromise = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/api/financiadores/${org.id}/novedades/`));
  await dialogo.getByRole("button", { name: "Guardar propuesta" }).click();
  const creada = await creadaPromise;
  expect(creada.status()).toBe(201);
  const propuesta = await creada.json();
  await expect(page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true })).toBeVisible();
  await dialogo.getByLabel("Motivo de la decisión").fill("Conciliación ficticia, sin aplicación al padrón.");
  const resueltaPromise = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/novedades/${propuesta.id}/resolver/`));
  await dialogo.getByRole("button", { name: "Conciliar sin aplicar efectos" }).click();
  const resuelta = await resueltaPromise;
  expect(resuelta.status()).toBe(200);
  expect((await resuelta.json()).efectos_aplicados).toBe(false);
  await expect(dialogo.getByText("Conciliada sin aplicación", { exact: true })).toBeVisible();
  await expect(dialogo.getByRole("region", { name: "Historial de la propuesta" }).getByRole("listitem")).toHaveCount(2);
  const despuesConciliar = await page.request.get(`/api/financiadores/${org.id}/padron/`, { headers: datos.headers });
  expect(await despuesConciliar.json()).toEqual(huella);
  const elegirEstado = dialogo.getByLabel("Estado de cobertura");
  await expect(elegirEstado).toBeEnabled();
  const habilitarObjetivo = propuesta.persona_actual.cobertura_habilitada !== true;
  const valorObjetivo = habilitarObjetivo ? "habilitar" : "deshabilitar";
  const indiceObjetivo = await elegirEstado.locator("option").evaluateAll((opciones, valor) =>
    opciones.findIndex((opcion) => opcion.value === valor), valorObjetivo);
  expect(indiceObjetivo).toBeGreaterThanOrEqual(0);
  await elegirEstado.focus();
  await elegirEstado.press("Home");
  for (let index = 0; index < indiceObjetivo; index += 1) await elegirEstado.press("ArrowDown");
  await elegirEstado.press("Enter");
  await expect(elegirEstado).toHaveValue(valorObjetivo);
  await dialogo.getByLabel("Motivo de la decisión").fill("Habilitación explícita desde evidencia revisada.");
  const aplicacionPromise = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/novedades/${propuesta.id}/habilitacion-cobertura/`));
  await dialogo.getByRole("button", { name: "Aplicar decisión de cobertura", exact: true }).click();
  const aplicacion = await aplicacionPromise;
  expect(aplicacion.status()).toBe(200);
  const resultado = await aplicacion.json();
  expect(resultado.efectos_aplicados).toBe(false);
  expect(resultado.habilitacion_cobertura.resultado).toBe("cambiada");
  expect(resultado.habilitacion_cobertura.cobertura_habilitada).toBe(habilitarObjetivo);
  await expect(dialogo.getByText(/Cambio enlazado al historial del padrón/)).toBeVisible();
  const historial = await page.request.get(`/api/financiadores/${org.id}/padron/${org.afiliado}/historial/`, { headers: datos.headers });
  expect(historial.ok()).toBeTruthy();
  const filasHistorial = (await historial.json()).results;
  const evento = filasHistorial.find((fila) => fila.id === resultado.habilitacion_cobertura.historial_id);
  expect(evento).toMatchObject({ origen: "novedad", lote: propuesta.id,
    cambios: { cobertura_habilitada: { anterior: !habilitarObjetivo, nuevo: habilitarObjetivo } } });
  const padronDespues = await page.request.get(`/api/financiadores/${org.id}/padron/${org.afiliado}/`, { headers: datos.headers });
  expect((await padronDespues.json()).cobertura_habilitada).toBe(habilitarObjetivo);
  await page.screenshot({ path: testInfo.outputPath("novedades.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(dialogo.getByRole("button", { name: "Cerrar", exact: true }).last()).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true }).click();
  const reabierta = page.getByRole("dialog");
  await expect(reabierta.getByText("Conciliada sin aplicación", { exact: true })).toBeVisible();
  await expect(reabierta.getByText(/Cambio enlazado al historial del padrón/)).toBeVisible();
  await page.goto(`/financiadores/padron/${org.afiliado}?financiador=${org.id}&tab=historial`);
  const panelHistorial = page.getByRole("tabpanel", { name: "Historial" });
  const enlaceFuente = page.getByRole("link", { name: `Ver novedad #${propuesta.id}`, exact: true });
  const eventoNovedad = panelHistorial.getByRole("listitem").filter({
    has: enlaceFuente,
  });
  await expect(eventoNovedad.getByRole("link", { name: `Ver novedad #${propuesta.id}`, exact: true })).toBeVisible();
  await expect(eventoNovedad.getByText("Novedad del financiador", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("rectificación y descarte dejan historia sin sobrescribir evidencia", async ({ page, baseURL }) => {
  const datos = await iniciar(page, baseURL);
  const org = datos.organizaciones[0];
  const original = await proponer(page, datos, org);
  await page.goto(`/financiadores/novedades?financiador=${org.id}`);
  await page.getByRole("button", { name: `Ver novedad ${original.id}`, exact: true }).click();
  let dialogo = page.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Registrar rectificación" }).click();
  await dialogo.getByLabel("Código informado").fill("RECTIFICADO");
  await dialogo.getByLabel("Motivo del registro").fill("Rectificación ficticia explícita.");
  const creadaPromise = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/api/financiadores/${org.id}/novedades/`));
  await dialogo.getByRole("button", { name: "Guardar propuesta" }).click();
  const creada = await (await creadaPromise).json();
  await expect(page.getByRole("dialog", { name: `Novedad #${creada.id}`, exact: true })).toBeVisible();
  await expect(dialogo.getByText("Revisión de conflictos", { exact: true })).toBeVisible();
  await dialogo.getByLabel("Motivo de la decisión").fill("Se revisó el antecedente; no se aplica al padrón.");
  const conciliar = dialogo.getByRole("button", { name: "Conciliar sin aplicar efectos" });
  await expect(conciliar).toBeDisabled();
  await dialogo.getByRole("checkbox", { name: "Revisé expresamente los conflictos y coincidencias indicados" }).check();
  await conciliar.click();
  await expect(dialogo.getByText("Conciliada sin aplicación", { exact: true })).toBeVisible();
  await expect(dialogo.getByRole("button", { name: "Cerrar", exact: true }).last()).toBeEnabled();
  await dialogo.getByRole("button", { name: "Cerrar", exact: true }).last().click();
  await page.getByRole("button", { name: `Ver novedad ${original.id}`, exact: true }).click();
  await dialogo.getByLabel("Motivo de la decisión").fill("Descarte ficticio conservando el antecedente.");
  await dialogo.getByRole("button", { name: "Descartar propuesta" }).click();
  await expect(dialogo.getByText("Descartada", { exact: true })).toBeVisible();
  const guardada = await page.request.get(`/api/financiadores/${org.id}/novedades/${original.id}/`, { headers: datos.headers });
  const persistida = await guardada.json();
  expect(persistida.original).toEqual(original.original);
  expect(persistida.historia).toHaveLength(2);
});

test("auditoría consulta evidencia pero no recibe acciones de escritura", async ({ page, baseURL }) => {
  const datos = await iniciar(page, baseURL, "auditor");
  const org = datos.organizaciones[0];
  await page.goto(`/financiadores/novedades?financiador=${org.id}`);
  await expect(page.getByRole("list", { name: "Novedades registradas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar novedad", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Ver novedad / }).first().click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("region", { name: "Evidencia original" })).toBeVisible();
  await expect(dialogo.getByRole("button", { name: "Registrar rectificación" })).toHaveCount(0);
  await expect(dialogo.getByRole("button", { name: "Conciliar sin aplicar efectos" })).toHaveCount(0);
});

test("detalle tardío no reaparece al cerrar y cambiar de financiador", async ({ page, baseURL }) => {
  const datos = await iniciar(page, baseURL);
  const [a, b] = datos.organizaciones;
  const propuesta = await proponer(page, datos, a);
  let liberar, inicio, completado;
  const espera = new Promise((resolve) => { liberar = resolve; });
  const iniciada = new Promise((resolve) => { inicio = resolve; });
  const finalizada = new Promise((resolve) => { completado = resolve; });
  await page.route(`**/api/financiadores/${a.id}/novedades/${propuesta.id}/`, async (route) => {
    const respuestaReal = await route.fetch();
    inicio();
    await espera;
    await route.fulfill({ response: respuestaReal });
    completado();
  });
  await page.goto(`/financiadores/novedades?financiador=${a.id}`);
  await page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true }).click();
  await iniciada;
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).last().click();
  const abrirMenu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await abrirMenu.isVisible()) await abrirMenu.click();
  await page.getByRole("combobox", { name: "Financiador", exact: true }).selectOption(String(b.id));
  await expect(page).toHaveURL(new RegExp(`financiador=${b.id}`));
  liberar();
  await finalizada;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true })).toHaveCount(0);
});
