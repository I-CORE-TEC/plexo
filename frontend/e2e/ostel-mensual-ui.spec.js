import { expect, test } from "@playwright/test";

// Padrón OSTEL del mes (#219): cinco grupos, un motivo por lote, bajas con
// confirmación explícita y conflictos corregidos con subsanar-ostel. API interceptada.
const lista = (results) => ({ count: results.length, next: null, previous: null, results });
const organizacion = { id: 21, nombre: "Mutual del Río", tipo: "mutual", rol: "admin" };
const GRUPOS = ["alta", "modificacion", "baja", "reingreso"];

function fila(n, grupo, extra = {}) {
  return { fila: n, fila_excel: n + 1, hoja: "afimotook", revision: 1, estado: grupo === "conflicto" ? "revision" : "valida",
    errores: [], advertencias: [], bloqueo_fuente: "", grupo, diferencias: [], fecha_baja: null, fecha_ingreso: null, plan_anterior: null,
    datos: { numero_interno: String(n), numero: `A${n}`, documento: `9901850${n}`, cuil: `209901850${n}1`, nombre: `PERSONA FICTICIA ${n}` },
    original: {}, correcciones: [], ...extra };
}

function conResumen(lote) {
  const vivas = lote.filas.filter((f) => f.estado !== "omitida");
  const cuenta = (estado) => lote.filas.filter((f) => f.estado === estado).length;
  return { ...lote, resumen: { total: lote.filas.length, valida: cuenta("valida"), revision: cuenta("revision"), aplicada: cuenta("aplicada"), omitida: cuenta("omitida"),
    contrato: 4, cobertura_habilitada: true,
    grupos: Object.fromEntries([...GRUPOS, "conflicto"].map((g) => [g, vivas.filter((f) => f.grupo === g).length])),
    pendientes: Object.fromEntries(GRUPOS.map((g) => [g, vivas.filter((f) => f.grupo === g && f.estado === "valida").length])) } };
}

function loteMensual() {
  return conResumen({ id: 300, tipo: "padron", version: 3, estado: "preview", filas: [
    fila(1, "alta"), fila(2, "alta"),
    fila(3, "modificacion", { diferencias: [{ campo: "nombre", anterior: "PERSONA ANTERIOR", nuevo: "PERSONA ACTUALIZADA" }, { campo: "email", anterior: "", nuevo: "nueva@example.test" }] }),
    fila(4, "baja", { fecha_baja: "2026-11-10" }),
    fila(5, "reingreso", { fecha_ingreso: "2026-11-01", plan_anterior: 31 }),
    fila(6, "conflicto", { errores: ["FECBAJ es una fecha futura. La baja se carga cuando ocurra."] }),
  ] });
}

async function escenario(page, { lote = loteMensual(), historial = [], sinProgreso = false } = {}) {
  const estado = { lote, aplicar: [], subsanar: [], confirmar: 0 };
  await page.addInitScript(() => { sessionStorage.setItem("salud.access", "token-ficticio-mock"); sessionStorage.setItem("salud.refresh", "refresh-ficticio-mock"); });
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.replace(/^\/api/, "");
    if (path === "/usuarios/me/") return route.fulfill({ json: { id: 9, email: "persona@example.test", nombre_completo: "Operador de prueba", is_superuser: false, capacidades_por_institucion: {}, roles_por_institucion: {}, financiadores: [{ ...organizacion, consulta_historia_clinica: true }] } });
    if (path === "/financiadores/") return route.fulfill({ json: lista([organizacion]) });
    const match = path.match(/^\/financiadores\/21\/(.+)\/$/);
    if (!match) return route.fulfill({ json: lista([]) });
    const recurso = match[1];
    if (recurso === "planes") return route.fulfill({ json: lista([{ id: 31, codigo: "BAS", nombre: "Plan Río", activo: true }]) });
    if (recurso === "importaciones") return route.fulfill({ json: lista(historial) });
    if (recurso === "previsualizar-ostel") return route.fulfill({ json: estado.lote });
    if (recurso === "confirmar-importacion") { estado.confirmar += 1; return route.fulfill({ status: 400, json: { detail: "No debe usarse" } }); }
    if (recurso === "aplicar-ostel") {
      const body = req.postDataJSON();
      estado.aplicar.push(body);
      if (!sinProgreso) {
        // Una fila por llamada para ejercitar el bucle de tandas.
        const siguiente = estado.lote.filas.find((f) => body.grupos.includes(f.grupo) && f.estado === "valida");
        if (siguiente) estado.lote = conResumen({ ...estado.lote, filas: estado.lote.filas.map((f) => f === siguiente ? { ...f, estado: "aplicada", afiliado: 500 + f.fila } : f) });
      }
      return route.fulfill({ json: estado.lote });
    }
    if (recurso === "subsanar-ostel") {
      const body = req.postDataJSON();
      estado.subsanar.push(body);
      estado.lote = conResumen({ ...estado.lote, filas: estado.lote.filas.map((f) => f.fila === body.fila
        ? { ...f, estado: "valida", grupo: "alta", errores: [], revision: 2, datos: body.datos } : f) });
      return route.fulfill({ json: estado.lote });
    }
    return route.fulfill({ json: lista([]) });
  });
  return estado;
}

async function abrirOstel(page) {
  await page.goto("/financiadores/padron?financiador=21");
  await page.getByRole("button", { name: "Importar Excel", exact: true }).click();
  await page.getByLabel("Formato del archivo", { exact: true }).selectOption("ostel");
}

async function revisar(page) {
  await abrirOstel(page);
  await expect(page.getByRole("heading", { name: "Importar padrón OSTEL del mes" })).toBeVisible();
  await page.getByLabel("Archivo Excel (.xlsx)", { exact: true }).setInputFiles({ name: "padron-noviembre.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("ficticio") });
  await page.getByRole("button", { name: "Revisar archivo", exact: true }).click();
}

test("vista previa muestra los cinco grupos con cantidades y el detalle de cada uno", async ({ page }) => {
  await escenario(page);
  await revisar(page);
  for (const [nombre, n] of [["Altas", 2], ["Modificaciones", 1], ["Bajas", 1], ["Reingresos", 1], ["Conflictos", 1]]) {
    await expect(page.getByRole("tab", { name: `${nombre} ${n}`, exact: true })).toBeVisible();
  }
  await page.getByRole("tab", { name: /^Modificaciones/ }).click();
  const cambios = page.getByRole("table", { name: "Cambios de la fila 4" });
  await expect(cambios.getByRole("row", { name: "Nombre completo PERSONA ANTERIOR PERSONA ACTUALIZADA" })).toBeVisible();
  await expect(cambios.getByRole("row", { name: "Email Sin informar nueva@example.test" })).toBeVisible();
  await page.getByRole("tab", { name: /^Bajas/ }).click();
  await expect(page.getByText("Baja el 10/11/2026. La afiliación termina ese día.")).toBeVisible();
  await page.getByRole("tab", { name: /^Reingresos/ }).click();
  await expect(page.getByText("Reingresa el 01/11/2026 con su plan anterior: Plan Río.")).toBeVisible();
  await page.getByRole("tab", { name: /^Conflictos/ }).click();
  await expect(page.getByText("FECBAJ es una fecha futura. La baja se carga cuando ocurra.")).toBeVisible();
  // Móvil: la tabla se desplaza dentro de su contenedor, nunca la página.
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBeLessThanOrEqual(0);
});

test("altas se aplican en tandas con un único motivo hasta vaciar los pendientes", async ({ page }) => {
  const estado = await escenario(page);
  await revisar(page);
  const aplicar = page.getByRole("button", { name: "Aplicar altas (2)", exact: true });
  await expect(aplicar).toBeDisabled();
  await page.getByLabel("Motivo del lote", { exact: true }).fill("Padrón OSTEL de noviembre");
  await aplicar.click();
  await expect(page.getByRole("button", { name: "Aplicar altas (0)", exact: true })).toBeDisabled();
  expect(estado.aplicar).toEqual([
    { importacion: 300, grupos: ["alta"], motivo: "Padrón OSTEL de noviembre", confirmar_bajas: false },
    { importacion: 300, grupos: ["alta"], motivo: "Padrón OSTEL de noviembre", confirmar_bajas: false },
  ]);
  await expect(page.getByRole("tab", { name: "Altas 2", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Aplicada", { exact: true })).toHaveCount(2);
  expect(estado.confirmar).toBe(0);
});

test("las bajas exigen confirmación explícita y envían confirmar_bajas", async ({ page }) => {
  const estado = await escenario(page);
  await revisar(page);
  await page.getByRole("tab", { name: /^Bajas/ }).click();
  await page.getByLabel("Motivo del lote", { exact: true }).fill("Bajas informadas por OSTEL");
  const aplicar = page.getByRole("button", { name: "Aplicar bajas (1)", exact: true });
  await expect(aplicar).toBeDisabled();
  await page.getByRole("checkbox", { name: "Confirmo aplicar 1 baja con su FECBAJ", exact: true }).check();
  await aplicar.click();
  await expect(page.getByRole("button", { name: "Aplicar bajas (0)", exact: true })).toBeDisabled();
  expect(estado.aplicar).toEqual([{ importacion: 300, grupos: ["baja"], motivo: "Bajas informadas por OSTEL", confirmar_bajas: true }]);
});

test("una tanda sin progreso detiene el bucle", async ({ page }) => {
  const estado = await escenario(page, { sinProgreso: true });
  await revisar(page);
  await page.getByLabel("Motivo del lote", { exact: true }).fill("Padrón OSTEL de noviembre");
  await page.getByRole("button", { name: "Aplicar altas (2)", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Quedan 2 filas sin aplicar" })).toBeVisible();
  expect(estado.aplicar).toHaveLength(1);
});

test("un conflicto se corrige en la misma pantalla con subsanar-ostel", async ({ page }) => {
  const estado = await escenario(page);
  await revisar(page);
  await page.getByRole("tab", { name: /^Conflictos/ }).click();
  await page.getByRole("button", { name: "Revisar fila", exact: true }).click();
  await page.getByLabel("Motivo de la revisión", { exact: true }).fill("Fecha verificada con OSTEL");
  await page.getByRole("button", { name: "Guardar y revalidar", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Conflictos 0", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Altas 3", exact: true })).toBeVisible();
  expect(estado.subsanar).toHaveLength(1);
  expect(estado.subsanar[0]).toMatchObject({ importacion: 300, fila: 6, revision: 1, accion: "corregir", motivo: "Fecha verificada con OSTEL" });
});

test("un lote anterior a los grupos mensuales queda sólo para consulta", async ({ page }) => {
  const viejo = { id: 180, tipo: "padron", version: 3, estado: "preview", creado: "2026-10-20T12:00:00Z",
    filas: [fila(1, undefined, { grupo: undefined })], resumen: { total: 1, valida: 1, revision: 0, aplicada: 0, fuente: "base" } };
  const estado = await escenario(page, { historial: [viejo] });
  await abrirOstel(page);
  await page.getByRole("button", { name: "Importaciones registradas", exact: true }).click();
  await page.getByRole("region", { name: "Importaciones registradas" }).getByRole("button", { name: /Importación 180/ }).click();
  await expect(page.getByText("Este lote se preparó antes de los grupos mensuales. Cargá el archivo nuevamente.")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Aplicar|^Importar \d/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver detalle", exact: true })).toHaveCount(1);
  expect(estado.confirmar).toBe(0);
  expect(estado.aplicar).toHaveLength(0);
});
