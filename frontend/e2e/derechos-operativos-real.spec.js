import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.skip(!process.env.SALUD_NOVEDADES_MANIFEST, "Requiere fixture sintética y servidores locales explícitos.");

async function autenticar(page, baseURL, rol = "operador") {
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

async function crearNovedadConciliada(page, datos, organizacion) {
  const creada = await page.request.post(`/api/financiadores/${organizacion.id}/novedades/`, {
    headers: datos.headers,
    data: {
      clave: randomUUID(), afiliado: organizacion.afiliado, fuente: "Prueba sintética de Derechos",
      referencia: `DERECHOS-${randomUUID()}`, codigo: `D-${randomUUID()}`,
      descripcion: "Evidencia creada por la prueba operativa aislada.", motivo: "Preparar una decisión explícita de prueba.",
    },
  });
  expect(creada.status()).toBe(201);
  const propuesta = await creada.json();
  const conciliada = await page.request.post(`/api/financiadores/${organizacion.id}/novedades/${propuesta.id}/resolver/`, {
    headers: datos.headers,
    data: {
      accion: "conciliar", motivo: "Revisión sintética de evidencia.", revision: propuesta.revision,
      revision_padron: propuesta.persona_actual.revision, confirmar_conflictos: false,
    },
  });
  expect(conciliada.status()).toBe(200);
  return propuesta;
}

async function crearAfiliacionSintetica(page, datos, organizacion, { nombre, desde, finalizar = false }) {
  const clave = randomUUID();
  const respuesta = await page.request.post(`/api/financiadores/${organizacion.id}/padron/`, {
    headers: datos.headers,
    data: {
      numero: `U2-${clave}`, documento: `U2-${clave}`, nombre,
      desde, cobertura_habilitada: true, motivo: "Escenario sintético aislado U2.",
    },
  });
  const contenido = await respuesta.json();
  expect(respuesta.status(), JSON.stringify(contenido)).toBe(201);
  let afiliado = contenido;
  expect(afiliado.cobertura_habilitada).toBe(true);
  if (finalizar) {
    const cierre = await page.request.post(`/api/financiadores/${organizacion.id}/finalizar-afiliacion/`, {
      headers: datos.headers,
      data: { afiliado: afiliado.id, motivo: "Escenario sintético aislado U2." },
    });
    expect(cierre.ok()).toBeTruthy();
    afiliado = await cierre.json();
    expect(afiliado.cobertura_habilitada).toBe(true);
    expect(afiliado.finalizado_en).toBeTruthy();
  }
  return afiliado;
}

test("operación por persona conserva el alcance y reutiliza la decisión explícita", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL);
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const propuesta = await crearNovedadConciliada(page, datos, organizacion);
  const fichaAntes = await page.request.get(
    `/api/financiadores/${organizacion.id}/ficha-afiliado/?${new URLSearchParams({ afiliado: organizacion.afiliado, page: 1, page_size: 10 })}`,
    { headers: datos.headers },
  );
  expect(fichaAntes.ok()).toBeTruthy();
  const coberturaAnterior = (await fichaAntes.json()).afiliado.cobertura_habilitada;
  const coberturaObjetivo = !coberturaAnterior;
  let escriturasDeCobertura = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/habilitacion-cobertura/")) escriturasDeCobertura += 1;
  });

  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  const menu = page.getByRole("navigation", { name: "Menú del financiador" });
  await expect(menu.getByRole("link", { name: "Derechos", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Borradores|Reglas de derechos/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Derechos por persona", exact: true })).toBeVisible();

  const solicitudPadron = page.waitForRequest((request) => {
    if (request.method() !== "GET" || !request.url().includes(`/api/financiadores/${organizacion.id}/padron/?`)) return false;
    const consulta = new URL(request.url()).searchParams;
    return consulta.get("search") === organizacion.documento && consulta.get("estado") === "todos";
  });
  await page.getByLabel("Buscar persona por documento, número o nombre").fill(organizacion.documento);
  await page.getByRole("button", { name: "Buscar persona", exact: true }).click();
  await solicitudPadron;
  await page.getByRole("button", { name: `Seleccionar afiliado #${organizacion.afiliado}`, exact: true }).click();
  expect(new URL(page.url()).searchParams.get("financiador")).toBe(String(organizacion.id));
  expect(new URL(page.url()).searchParams.get("afiliado")).toBe(String(organizacion.afiliado));
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`buscar=${organizacion.documento}`));
  expect(new URL(page.url()).searchParams.has("afiliado")).toBe(false);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`afiliado=${organizacion.afiliado}`));
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver ficha actual", exact: true })).toHaveAttribute(
    "href", `/financiadores/padron/${organizacion.afiliado}?financiador=${organizacion.id}`,
  );
  await expect(page.getByRole("link", { name: "Ver reglas de cobertura", exact: true })).toHaveAttribute(
    "href", `/financiadores/reglas?financiador=${organizacion.id}`,
  );
  await expect(page.getByText(/no garantizan una prestación ni un pago/i)).toBeVisible();

  await expect(page.getByRole("list", { name: "Novedades registradas" }).getByText(`#${propuesta.id}`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true }).click();
  const detalle = page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true });
  await expect(detalle).toBeVisible();
  expect(escriturasDeCobertura).toBe(0);
  await detalle.getByLabel("Estado de cobertura").selectOption(coberturaObjetivo ? "habilitar" : "deshabilitar");
  await detalle.getByLabel("Motivo de la decisión").fill("Decisión explícita de prueba desde Derechos.");
  const guardadaPromise = page.waitForResponse((response) => response.request().method() === "POST"
    && response.url().endsWith(`/novedades/${propuesta.id}/habilitacion-cobertura/`));
  await detalle.getByRole("button", { name: "Aplicar decisión de cobertura", exact: true }).click();
  const guardada = await guardadaPromise;
  expect(guardada.status()).toBe(200);
  const resultado = await guardada.json();
  expect(resultado.habilitacion_cobertura.cobertura_habilitada).toBe(coberturaObjetivo);
  expect(escriturasDeCobertura).toBe(1);

  const fichaDespues = await page.request.get(
    `/api/financiadores/${organizacion.id}/ficha-afiliado/?${new URLSearchParams({ afiliado: organizacion.afiliado, page: 1, page_size: 10 })}`,
    { headers: datos.headers },
  );
  expect((await fichaDespues.json()).afiliado.cobertura_habilitada).toBe(coberturaObjetivo);
  const historial = await page.request.get(`/api/financiadores/${organizacion.id}/padron/${organizacion.afiliado}/historial/`, { headers: datos.headers });
  expect(historial.ok()).toBeTruthy();
  expect((await historial.json()).results).toContainEqual(expect.objectContaining({ lote: propuesta.id, origen: "novedad" }));
  await expect(detalle.getByRole("link", { name: "Ver historial", exact: true })).toBeVisible();
});

test("Borradores conserva su URL de consulta como configuración secundaria no operativa", async ({ page, baseURL }, testInfo) => {
  const preparacion = await autenticar(page, baseURL, "operador");
  const organizacion = preparacion.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const propuesta = await crearNovedadConciliada(page, preparacion, organizacion);
  const datos = await autenticar(page, baseURL, "auditor");
  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toBeVisible();
  await page.getByLabel("Buscar persona por documento, número o nombre").fill(organizacion.documento);
  await page.getByRole("button", { name: "Buscar persona", exact: true }).click();
  await page.getByRole("button", { name: `Seleccionar afiliado #${organizacion.afiliado}`, exact: true }).click();
  await page.getByRole("button", { name: `Ver novedad ${propuesta.id}`, exact: true }).click();
  const detalle = page.getByRole("dialog", { name: `Novedad #${propuesta.id}`, exact: true });
  await expect(detalle).toBeVisible();
  await expect(detalle.getByLabel("Estado de cobertura")).toHaveCount(0);
  await expect(detalle.getByLabel("Motivo de la decisión")).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Aplicar decisión de cobertura", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(detalle).toHaveCount(0);
  const accesoBorradores = page.getByRole("link", { name: "Borradores de derechos (no operativo)", exact: true });
  await expect(accesoBorradores).toBeVisible();
  await accesoBorradores.click();
  await expect(page).toHaveURL(new RegExp(`/financiadores/borradores\\?financiador=${organizacion.id}`));
  await expect(page.getByRole("heading", { name: "Borradores de reglas de derechos", exact: true })).toBeVisible();
  await expect(page.getByText("Módulo de configuración no operativa", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar borrador", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Volver a Derechos", exact: true })).toHaveAttribute(
    "href", `/financiadores/derechos?financiador=${organizacion.id}`,
  );
  await page.getByRole("link", { name: "Volver a Derechos", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/financiadores/derechos\\?financiador=${organizacion.id}`));
});

test("las clasificaciones futuras y finalizadas prevalecen visualmente sobre cobertura habilitada", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL);
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const futura = { id: organizacion.afiliado_futuro, documento: organizacion.documento_futuro };
  const fechaActual = new Date().toISOString().slice(0, 10);
  const finalizada = await crearAfiliacionSintetica(page, datos, organizacion, {
    nombre: "PERSONA SINTETICA U2 FINALIZADA", desde: fechaActual, finalizar: true,
  });

  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  let escriturasCobertura = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/habilitacion-cobertura/")) escriturasCobertura += 1;
  });
  for (const [afiliado, clasificacion] of [[futura, "Futura"], [finalizada, "Finalizada"]]) {
    await page.getByLabel("Buscar persona por documento, número o nombre").fill(afiliado.documento);
    await page.getByRole("button", { name: "Buscar persona", exact: true }).click();
    await page.getByRole("button", { name: `Seleccionar afiliado #${afiliado.id}`, exact: true }).click();
    const situacion = page.getByRole("region", { name: "Situación de afiliación" });
    await expect(situacion.getByText(clasificacion, { exact: true })).toBeVisible();
    await expect(situacion.getByText("Habilitada", { exact: true })).toBeVisible();
    await expect(situacion.getByText(/no garantizan una prestación ni un pago/i)).toBeVisible();
  }
  expect(escriturasCobertura).toBe(0);
});

test("una identidad sin membresía no abre Derechos ni la URL histórica de Borradores", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL, "sin_membresia");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const accesosOrganizacion = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith(`/api/financiadores/${organizacion.id}/`)) {
      accesosOrganizacion.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  });

  for (const ruta of ["derechos", "borradores"]) {
    await page.goto(`/financiadores/${ruta}?financiador=${organizacion.id}`);
    await expect(page.getByText("No tenés acceso al financiador seleccionado", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
  }
  expect(accesosOrganizacion).toEqual([]);
});
