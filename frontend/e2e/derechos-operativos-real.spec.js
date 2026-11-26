import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
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

async function autenticarManual(page, baseURL, rol = "operador") {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  const datos = JSON.parse(fs.readFileSync(process.env.SALUD_NOVEDADES_MANIFEST, "utf8"));
  expect(datos.purpose).toBe("salud-novedades-e2e");
  expect(datos.manual?.organizaciones?.length).toBeGreaterThan(0);
  const manual = datos.manual;
  const respuesta = await page.request.post("/api/auth/token/", {
    data: { email: manual[rol], password: manual.password },
  });
  expect(respuesta.ok()).toBeTruthy();
  const sesion = await respuesta.json();
  await page.addInitScript(({ access, refresh }) => {
    sessionStorage.setItem("salud.access", access);
    sessionStorage.setItem("salud.refresh", refresh);
  }, sesion);
  return { ...manual, headers: { Authorization: `Bearer ${sesion.access}` } };
}

async function abrirPersonaManual(page, organizacion, persona) {
  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  await page.getByLabel("Buscar persona por documento, número o nombre").fill(persona.documento);
  await page.getByRole("button", { name: "Buscar persona", exact: true }).click();
  await page.getByRole("button", { name: `Seleccionar afiliado #${persona.id}`, exact: true }).click();
  return page.getByRole("region", { name: "Situación de afiliación" });
}

function ejecutarFixture(args) {
  const fixture = path.resolve("e2e/fixtures/preparar_novedades_real.py");
  const python = process.env.SALUD_DERECHOS_PYTHON || "python";
  const resultado = spawnSync(python, [fixture, ...args], {
    cwd: path.resolve("../backend"),
    encoding: "utf8",
    timeout: 30000,
    env: process.env,
  });
  return resultado;
}

function hashBaseAislada() {
  const python = process.env.SALUD_DERECHOS_PYTHON || "python";
  const consulta = [
    "import django, hashlib, json",
    "django.setup()",
    "from django.db import connection",
    "estado = {}",
    "with connection.cursor() as cursor:",
    "    for tabla in sorted(connection.introspection.table_names()):",
    "        cursor.execute('SELECT * FROM ' + connection.ops.quote_name(tabla))",
    "        estado[tabla] = sorted(json.dumps(fila, default=str, ensure_ascii=False) for fila in cursor.fetchall())",
    "print(hashlib.sha256(json.dumps(estado, sort_keys=True, ensure_ascii=False).encode()).hexdigest())",
  ].join("\n");
  const resultado = spawnSync(python, ["-B", "-c", consulta], {
    cwd: path.resolve("../backend"),
    encoding: "utf8",
    timeout: 30000,
    env: process.env,
  });
  expect(resultado.error).toBeUndefined();
  expect(resultado.status).toBe(0);
  expect(resultado.stdout.trim()).toMatch(/^[a-f0-9]{64}$/);
  return resultado.stdout.trim();
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

async function verifyCoverageExplanation(page) {
  await page.getByRole("button", { name: "Ayuda: Situación de afiliación", exact: true }).click();
  await expect(page.getByText("La habilitación requiere una decisión explícita. Fechas, plan, convenio, reglas del servicio, cupos y autorización determinan la cobertura de cada prestación.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

test("operación por persona conserva el alcance sin el panel de novedades retirado", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL);
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const consultasNovedades = [];
  page.on("request", (request) => {
    if (request.url().includes("/novedades/")) consultasNovedades.push(request.url());
  });

  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  const menu = page.getByRole("navigation", { name: "Menú del financiador" });
  await expect(menu.getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
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
  await verifyCoverageExplanation(page);

  // La compatibilidad antigua llega al mismo circuito dentro de la ficha.
  await page.getByRole("link", { name: "Ver ficha actual", exact: true }).click();
  await page.getByRole("tab", { name: "Derechos", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Derechos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buscar persona", exact: true })).toHaveCount(0);

  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Novedades registradas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Registrar novedad", exact: true })).toHaveCount(0);
  expect(consultasNovedades).toEqual([]);
});

test("la ayuda de Situación de afiliación no ofrece borradores retirados", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL, "auditor");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}`);
  await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
  await page.getByLabel("Buscar persona por documento, número o nombre").fill(organizacion.documento);
  await page.getByRole("button", { name: "Buscar persona", exact: true }).click();
  await page.getByRole("button", { name: `Seleccionar afiliado #${organizacion.afiliado}`, exact: true }).click();
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  const accesoBorradores = page.getByRole("link", { name: "Borradores de derechos", exact: true });
  await expect(accesoBorradores).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda: Situación de afiliación", exact: true }).click();
  await expect(page.getByRole("link", { name: "Borradores de derechos", exact: true })).toHaveCount(0);
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
    await verifyCoverageExplanation(page);
  }
  expect(escriturasCobertura).toBe(0);
});

test("una identidad sin membresía no abre Derechos", async ({ page, baseURL }, testInfo) => {
  const datos = await autenticar(page, baseURL, "sin_membresia");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const accesosOrganizacion = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith(`/api/financiadores/${organizacion.id}/`)) {
      accesosOrganizacion.push({ method: request.method(), path: new URL(request.url()).pathname });
    }
  });

  for (const ruta of ["derechos"]) {
    await page.goto(`/financiadores/${ruta}?financiador=${organizacion.id}`);
    await expect(page.getByText("No tenés acceso al financiador seleccionado", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
  }
  expect(accesosOrganizacion).toEqual([]);
});

test("los rechazos del preparador conservan el manifiesto y no escriben archivos", async () => {
  const manifiesto = process.env.SALUD_NOVEDADES_MANIFEST;
  const original = fs.readFileSync(manifiesto);
  const existente = ejecutarFixture([manifiesto]);
  expect(existente.error).toBeUndefined();
  expect(existente.status).not.toBe(0);
  expect(`${existente.stdout}${existente.stderr}`).toMatch(/manifiesto/i);
  expect(fs.readFileSync(manifiesto)).toEqual(original);

  const rutaEquivocadaExistente = path.resolve("e2e/derechos-operativos-real.spec.js");
  const contenidoExistente = fs.readFileSync(rutaEquivocadaExistente);
  const ruta = ejecutarFixture([rutaEquivocadaExistente]);
  expect(ruta.error).toBeUndefined();
  expect(ruta.status).not.toBe(0);
  expect(`${ruta.stdout}${ruta.stderr}`).toMatch(/temporal|fuera/i);
  expect(fs.readFileSync(rutaEquivocadaExistente)).toEqual(contenidoExistente);

  const opcion = ejecutarFixture(["--opcion-no-admitida", manifiesto]);
  expect(opcion.error).toBeUndefined();
  expect(opcion.status).not.toBe(0);
  expect(`${opcion.stdout}${opcion.stderr}`).toMatch(/unrecognized arguments|argumentos no reconocidos/i);
  expect(fs.readFileSync(manifiesto)).toEqual(original);
});

test("un fallo al escribir el manifiesto revierte toda la preparación estándar y manual", async () => {
  const resultados = [];
  for (const [modo, argumentos] of [["estándar", []], ["manual", ["--manual"]]]) {
    const directorioAusente = path.join(tmpdir(), `derechos-u3-atomic-${randomUUID()}`, modo);
    const manifiesto = path.join(directorioAusente, "manifest.json");
    expect(fs.existsSync(directorioAusente)).toBe(false);
    const antes = hashBaseAislada();
    const intento = ejecutarFixture([...argumentos, manifiesto]);
    const despues = hashBaseAislada();
    resultados.push({
      modo, antes, despues, error: intento.error,
      status: intento.status,
      fileError: `${intento.stdout}${intento.stderr}`.includes("FileNotFoundError"),
      manifiestoCreado: fs.existsSync(manifiesto),
    });
  }
  expect(resultados.map(({ modo }) => modo)).toEqual(["estándar", "manual"]);
  expect(resultados.map(({ error }) => error)).toEqual([undefined, undefined]);
  expect(resultados.map(({ status }) => status)).toEqual([1, 1]);
  expect(resultados.map(({ fileError }) => fileError)).toEqual([true, true]);
  expect(resultados.map(({ manifiestoCreado }) => manifiestoCreado)).toEqual([false, false]);
  expect(resultados.map(({ antes, despues }) => despues === antes)).toEqual([true, true]);
});

test("la preparación manual separa actores y conserva la historia de novedades sin la pantalla retirada", async ({ page, baseURL }, testInfo) => {
  test.skip(!process.env.SALUD_DERECHOS_MANUAL, "Requiere un manifiesto separado con --manual.");
  const datos = await autenticarManual(page, baseURL, "operador");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const escenarios = organizacion.escenarios;
  const normal = JSON.parse(fs.readFileSync(process.env.SALUD_NOVEDADES_MANIFEST, "utf8"));
  expect(datos.operador).not.toBe(normal.operador);
  expect(datos.auditor).not.toBe(normal.auditor);
  expect(organizacion.id).not.toBe(normal.organizaciones[0].id);

  const detalle = async (novedad) => page.request.get(
    `/api/financiadores/${organizacion.id}/novedades/${novedad}/`, { headers: datos.headers },
  );
  const ficha = async (afiliado) => page.request.get(
    `/api/financiadores/${organizacion.id}/ficha-afiliado/?${new URLSearchParams({ afiliado: String(afiliado), page: "1", page_size: "10" })}`,
    { headers: datos.headers },
  );

  const antes = await detalle(escenarios.decision.novedad);
  expect(antes.status()).toBe(200);
  const propuesta = await antes.json();
  expect(propuesta.estado).toBe("pendiente");
  expect(propuesta.persona_actual.cobertura_habilitada).toBe(false);
  const conciliada = await page.request.post(
    `/api/financiadores/${organizacion.id}/novedades/${escenarios.decision.novedad}/resolver/`, {
      headers: datos.headers,
      data: {
        accion: "conciliar", motivo: "Conciliación sintética sin efectos.", revision: propuesta.revision,
        revision_padron: propuesta.persona_actual.revision, confirmar_conflictos: false,
      },
    },
  );
  expect(conciliada.status()).toBe(200);
  const conciliacion = await conciliada.json();
  expect(conciliacion.estado).toBe("conciliada");
  expect(conciliacion.habilitacion_cobertura).toBeFalsy();
  expect((await (await ficha(escenarios.decision.afiliado.id)).json()).afiliado.cobertura_habilitada).toBe(false);

  // El enlace viejo con novedad abre sólo la situación de la persona: no hay
  // diálogo ni controles de decisión, y nada escribe cobertura.
  let escrituras = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/habilitacion-cobertura/")) escrituras += 1;
  });
  await page.goto(`/financiadores/derechos?financiador=${organizacion.id}&afiliado=${escenarios.decision.afiliado.id}&novedad=${escenarios.decision.novedad}`);
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Estado de cobertura")).toHaveCount(0);
  expect(escrituras).toBe(0);

  const aplicada = await (await detalle(escenarios.aplicada.novedad)).json();
  expect(aplicada.habilitacion_cobertura.resultado).toBe("cambiada");
  expect(aplicada.habilitacion_cobertura.historial_id).toBe(escenarios.aplicada.historial);
  const sinCambios = await (await detalle(escenarios.sin_cambios.novedad)).json();
  expect(sinCambios.habilitacion_cobertura.resultado).toBe("sin_cambios");
  expect(sinCambios.habilitacion_cobertura.historial_id).toBeNull();
  const historiaSinCambios = await page.request.get(
    `/api/financiadores/${organizacion.id}/padron/${escenarios.sin_cambios.afiliado.id}/historial/`,
    { headers: datos.headers },
  );
  expect(historiaSinCambios.ok()).toBeTruthy();
  expect((await historiaSinCambios.json()).results).not.toContainEqual(expect.objectContaining({
    lote: escenarios.sin_cambios.novedad, origen: "novedad",
  }));
  await page.goto(`/financiadores/padron/${escenarios.aplicada.afiliado.id}?financiador=${organizacion.id}&tab=historial`);
  const historiaAplicada = page.getByRole("region", { name: "Historia administrativa" });
  await expect(historiaAplicada).toContainText(`Novedad #${escenarios.aplicada.novedad}`);
  await expect(historiaAplicada.getByRole("link", { name: /Ver novedad/ })).toHaveCount(0);
});

test("evidencia manual obsoleta se rechaza sin efectos y se distinguen las vigencias", async ({ page, baseURL }, testInfo) => {
  test.skip(!process.env.SALUD_DERECHOS_MANUAL, "Requiere un manifiesto separado con --manual.");
  const datos = await autenticarManual(page, baseURL, "operador");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const escenarios = organizacion.escenarios;
  const detalleRuta = (id) => `/api/financiadores/${organizacion.id}/novedades/${id}/`;
  const antes = await (await page.request.get(detalleRuta(escenarios.conflicto.novedad), { headers: datos.headers })).json();
  expect(antes.estado).toBe("pendiente");
  expect(antes.conflictos).toContain("padron_modificado");
  const rechazo = await page.request.post(
    `/api/financiadores/${organizacion.id}/novedades/${escenarios.conflicto.novedad}/resolver/`, {
      headers: datos.headers,
      data: {
        accion: "conciliar", motivo: "Intento sintético con evidencia obsoleta.", revision: antes.revision,
        revision_padron: antes.persona_actual.revision, confirmar_conflictos: false,
      },
    },
  );
  expect(rechazo.status()).toBe(400);
  const despues = await (await page.request.get(detalleRuta(escenarios.conflicto.novedad), { headers: datos.headers })).json();
  expect(despues.estado).toBe("pendiente");
  expect(despues.persona_actual.cobertura_habilitada).toBe(false);
  expect(despues.habilitacion_cobertura).toBeFalsy();

  const futura = await abrirPersonaManual(page, organizacion, escenarios.futura);
  await expect(futura.getByText("Futura", { exact: true })).toBeVisible();
  await expect(futura.getByText("Habilitada", { exact: true })).toBeVisible();
  const finalizada = await abrirPersonaManual(page, organizacion, escenarios.finalizada);
  await expect(finalizada.getByText("Finalizada", { exact: true })).toBeVisible();
  await expect(finalizada.getByText("Habilitada", { exact: true })).toBeVisible();
});

test("el auditor manual llega desde un enlace viejo de Novedades al historial sin controles de decisión", async ({ page, baseURL }, testInfo) => {
  test.skip(!process.env.SALUD_DERECHOS_MANUAL, "Requiere un manifiesto separado con --manual.");
  const datos = await autenticarManual(page, baseURL, "auditor");
  const organizacion = datos.organizaciones[testInfo.project.name === "mobile-chromium" ? 1 : 0];
  const decision = organizacion.escenarios.decision;
  await page.goto(`/financiadores/novedades?financiador=${organizacion.id}&afiliado=${decision.afiliado.id}&novedad=${decision.novedad}`);
  await expect(page).toHaveURL(new RegExp(`/financiadores/padron/${decision.afiliado.id}\\?financiador=${organizacion.id}&tab=historial$`));
  await expect(page.getByRole("region", { name: "Historia administrativa" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aplicar decisión de cobertura", exact: true })).toHaveCount(0);
});
