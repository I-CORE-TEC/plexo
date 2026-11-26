import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

if (!process.env.SALUD_IMPORTACION_MANIFEST) throw new Error("Falta manifiesto ficticio del entorno PostgreSQL aislado.");
const datos = JSON.parse(readFileSync(process.env.SALUD_IMPORTACION_MANIFEST, "utf8"));
if (datos.escenario !== "importacion-respuesta-v1" || !datos.organizacion || !datos.email.endsWith("@example.invalid")) {
  throw new Error("El manifiesto no pertenece al escenario ficticio de importación.");
}
const base = `/api/financiadores/${datos.organizacion}/`;

async function fetchReal(route, opciones = {}) {
  try {
    return await route.fetch({ timeout: 60000, ...opciones });
  } catch {
    // Playwright incluye Authorization al imprimir errores de route.fetch.
    // Mantener el fallo explícito sin registrar credenciales, ni siquiera de test.
    throw new Error("La petición al servidor de prueba no pudo completarse.");
  }
}

async function acceso(page) {
  await page.goto("/login");
  await page.getByLabel(/Email/).fill(datos.email);
  await page.getByLabel(/^Contraseña/).fill(datos.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(`/financiadores/padron?financiador=${datos.organizacion}`);
  await page.getByRole("button", { name: "Importar Excel", exact: true }).click();
  await page.getByLabel("Formato del archivo", { exact: true }).selectOption("ostel");
  await page.getByRole("checkbox", { name: "Habilitar cobertura", exact: true }).uncheck();
}

// #219: el padrón OSTEL del mes se aplica por grupos (aplicar-ostel) con un
// motivo único; las filas ficticias son personas nuevas, es decir, altas.
const MOTIVO = "Padrón ficticio E2E del mes";
const aplicarAltas = (page, n) => page.getByRole("button", { name: `Aplicar altas (${n})`, exact: true });

async function cargar(page, caso) {
  await acceso(page);
  await page.getByLabel("Archivo Excel (.xlsx)", { exact: true }).setInputFiles(caso.archivo);
  await page.getByRole("button", { name: "Revisar archivo", exact: true }).click();
  await expect(page.getByRole("tab", { name: `Altas ${caso.validas}`, exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Motivo del lote", { exact: true }).fill(MOTIVO);
  await expect(aplicarAltas(page, caso.validas)).toBeEnabled();
}

async function headers(request) {
  const respuesta = await request.post("/api/auth/token/", { data: { email: datos.email, password: datos.password } });
  expect(respuesta.status()).toBe(200);
  return { Authorization: `Bearer ${(await respuesta.json()).access}` };
}

async function persistido(request, id, h) {
  const respuesta = await request.get(`${base}importaciones/?tipo=padron`, { headers: h });
  expect(respuesta.status()).toBe(200);
  const lote = (await respuesta.json()).results.find((item) => item.id === id);
  expect(lote).toBeTruthy();
  return lote;
}

async function comprobarPadron(request, caso, cantidad, h) {
  const respuesta = await request.get(`${base}padron/?search=${encodeURIComponent(caso.prefijo)}&estado=todos`, { headers: h });
  expect(respuesta.status()).toBe(200);
  const padron = await respuesta.json();
  expect(padron.count).toBe(cantidad);
  for (const afiliado of padron.results) expect(afiliado.cobertura_habilitada).toBe(false);
}

test("UI real aplica altas en varias tandas y conserva el conflicto", async ({ page, request }) => {
  const caso = datos.casos.normal;
  const respuestas = [];
  const pedidos = [];
  await page.route(`**${base}aplicar-ostel/**`, async (route) => {
    pedidos.push(route.request().postDataJSON());
    const respuesta = await fetchReal(route);
    respuestas.push(await respuesta.json());
    await route.fulfill({ response: respuesta });
  });
  await cargar(page, caso);
  await aplicarAltas(page, caso.validas).click();
  await expect(aplicarAltas(page, 0)).toBeDisabled({ timeout: 60000 });
  expect(pedidos.every((p) => p.motivo === MOTIVO && p.grupos.join() === "alta" && p.confirmar_bajas === false)).toBe(true);
  expect(respuestas.map((r) => r.resumen.pendientes.alta)).toEqual([105, 5, 0]);
  await page.getByRole("tab", { name: "Conflictos 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Revisar fila", exact: true })).toHaveCount(1);
  await page.getByRole("tab", { name: /^Altas/ }).click();
  await expect(page.getByRole("button", { name: "Ver detalle", exact: true })).toHaveCount(20);
  await page.getByRole("button", { name: "Ver detalle", exact: true }).first().click();
  await page.getByText("Valores originales del archivo", { exact: true }).click();
  await expect(page.getByText(`${caso.prefijo}-1`, { exact: true }).first()).toBeVisible();
  const h = await headers(request);
  const lote = await persistido(request, respuestas[0].id, h);
  expect(lote.resumen.aplicada).toBe(205);
  expect(lote.resumen.revision).toBe(1);
  expect(lote.filas.at(-1).original.CUIL).toBe("123");
  await comprobarPadron(request, caso, 205, h);
});

test("respuesta perdida después del commit se recupera con reintento explícito", async ({ page, request }) => {
  const caso = datos.casos.respuesta_perdida;
  const respuestas = [];
  const pedidos = [];
  await page.route(`**${base}aplicar-ostel/**`, async (route) => {
    pedidos.push(route.request().postDataJSON());
    const respuesta = await fetchReal(route); // API y commit reales.
    respuestas.push(await respuesta.json());
    if (pedidos.length === 2) await route.abort("connectionreset");
    else await route.fulfill({ response: respuesta });
  });
  await cargar(page, caso);
  await aplicarAltas(page, 205).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 60000 });
  expect(pedidos).toHaveLength(2);
  const h = await headers(request);
  expect((await persistido(request, respuestas[0].id, h)).resumen.aplicada).toBe(200);
  // La UI conserva la última respuesta recibida; el reintento aplica sólo lo que falta.
  await aplicarAltas(page, 105).click();
  await expect(aplicarAltas(page, 0)).toBeDisabled({ timeout: 60000 });
  expect(pedidos).toHaveLength(3);
  expect((await persistido(request, respuestas[0].id, h)).resumen.aplicada).toBe(205);
  await comprobarPadron(request, caso, 205, h);
});

test("otra sesión excluye una fila y el cliente recupera la evidencia actual", async ({ page, request }) => {
  const caso = datos.casos.otra_sesion;
  const h = await headers(request);
  const respuestas = [];
  await page.route(`**${base}aplicar-ostel/**`, async (route) => {
    if (respuestas.length === 1) {
      const fila = respuestas[0].filas.find((f) => f.estado === "valida");
      const cambio = await request.post(`${base}subsanar-ostel/`, { headers: h, data: {
        importacion: respuestas[0].id, fila: fila.fila, revision: fila.revision, datos: fila.datos,
        motivo: "Exclusión ficticia desde otra sesión", accion: "omitir",
      } });
      expect(cambio.status()).toBe(200);
    }
    const respuesta = await fetchReal(route);
    respuestas.push(await respuesta.json());
    await route.fulfill({ response: respuesta });
  });
  await cargar(page, caso);
  await aplicarAltas(page, 101).click();
  await expect(aplicarAltas(page, 0)).toBeDisabled({ timeout: 60000 });
  expect(respuestas).toHaveLength(2);
  await page.getByRole("tab", { name: /^Excluidas/ }).click();
  await expect(page.getByRole("button", { name: "Ver detalle", exact: true })).toHaveCount(1);
  const lote = await persistido(request, respuestas[0].id, h);
  expect(lote.resumen.aplicada).toBe(100);
  expect(lote.resumen.omitida).toBe(1);
  expect(lote.filas.find((f) => f.estado === "omitida").correcciones.at(-1).motivo).toBe("Exclusión ficticia desde otra sesión");
  await comprobarPadron(request, caso, 100, h);
});

test("el lote mensual nunca usa confirmar-importacion", async ({ page, request }) => {
  const caso = datos.casos.completa;
  let confirmaciones = 0;
  await page.route(`**${base}confirmar-importacion/**`, (route) => { confirmaciones += 1; return route.abort(); });
  await cargar(page, caso);
  await aplicarAltas(page, 101).click();
  await expect(aplicarAltas(page, 0)).toBeDisabled({ timeout: 60000 });
  expect(confirmaciones).toBe(0);
  await comprobarPadron(request, caso, 101, await headers(request));
});
