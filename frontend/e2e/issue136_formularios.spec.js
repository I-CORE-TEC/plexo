import { test, expect } from "@playwright/test";

const lista = (results) => ({ results, count: results.length, next: null, previous: null });
async function escenario(page, institucion = true) {
  const escrituras = [];
  await page.addInitScript((institucion) => {
    sessionStorage.setItem("salud.access", "token-sintetico-issue136");
    sessionStorage.setItem("salud.refresh", "refresh-sintetico-issue136");
    if (institucion) localStorage.setItem("salud.institucion", JSON.stringify({ id: 21, nombre: "Institución ficticia" }));
  }, institucion);
  page.on("pageerror", (e) => { throw e; });
  await page.route("**/api/**", async (route) => {
    const req = route.request(), u = new URL(req.url()), path = u.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (req.method() === "POST" || req.method() === "PATCH") {
      const body = req.postDataJSON(); escrituras.push({ path, body });
      return route.fulfill({ json: { id: 45, ...body } });
    }
    if (path === "/api/usuarios/me/") return route.fulfill({ json: { id: 1, email: "operador@example.invalid", nombre_completo: "Operador ficticio", is_superuser: true, capacidades_por_institucion: { 21: ["gobierno_plataforma", "padron_admision", "historia_clinica"] }, roles_por_institucion: { 21: ["admin"] }, financiadores: [] } });
    if (path === "/api/instituciones/") return route.fulfill({ json: lista([{ id: 21, nombre: "Institución ficticia", estado: "activa", activa: true }]) });
    if (path === "/api/instituciones/tablero-plataforma/") return route.fulfill({ json: { instituciones: 1, activas: 1, en_alta: 0, atendidos: 0, personal_activo: 0, ocupacion: 0, alertas: [], serie: [], indicadores: [] } });
    if (path === "/api/financiadores/") return route.fulfill({ json: lista([{ id: 21, nombre: "Financiador ficticio", rol: "admin", tipo: "mutual" }]) });
    if (path === "/api/financiadores/21/planes/") return route.fulfill({ json: lista([{ id: 31, nombre: "Plan ficticio", activo: true, codigo: "PRUEBA" }]) });
    if (path === "/api/ciudadanos/configuracion-cobertura/") return route.fulfill({ json: { habilitada: false } });
    if (path === "/api/geografia/estado/") return route.fulfill({ json: { version: 1, actualizado: "2026-10-22T00:00:00Z", error: "" } });
    if (path === "/api/geografia/lugares/") return route.fulfill({ json: lista([]) });
    return route.fulfill({ json: lista([]) });
  });
  return escrituras;
}

async function provinciaManual(page, nombre, pagina = page) {
  const ubicacion = page.getByLabel("Ubicación territorial", { exact: true }).first();
  const ancho = (await ubicacion.boundingBox()).width;
  const anchos = await ubicacion.locator("input, select").evaluateAll((controles) => controles.map((c) => c.getBoundingClientRect().width));
  expect(anchos.every((valor) => valor >= Math.min(240, ancho) - 1)).toBeTruthy();
  await page.getByRole("combobox", { name: "Provincia", exact: true }).first().fill(nombre);
  await pagina.getByRole("option", { name: "Cargar manualmente", exact: true }).click();
  await page.getByRole("textbox", { name: "Provincia · carga manual", exact: true }).fill(nombre);
}

for (const { width, geografia, expected } of [
  {
    width: 1440,
    geografia: null,
    expected: [
      ["Provincia", "Provincia de prueba", "Sin homologar"],
      ["Partido", "Partido de prueba", "Sin homologar"],
      ["Localidad", "Localidad de prueba", "Sin homologar"],
    ],
  },
  {
    width: 390,
    geografia: {
      provincia: { id: 7, nombre: "Provincia de prueba", origen: "georef" },
      partido: { id: 8, nombre: "Partido de prueba", origen: "manual" },
      localidad: null,
    },
    expected: [
      ["Provincia", "Provincia de prueba", "Georef"],
      ["Partido", "Partido de prueba", "Manual · sin verificar"],
      ["Localidad", "Localidad de prueba", "Sin homologar"],
    ],
  },
]) {
  test(`shows affiliate address origins in read-only data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await escenario(page);
    const afiliado = {
      id: 45, nombre: "Afiliado ficticio", numero: "GEO-45", documento: "99029901",
      provincia: "Provincia de prueba", partido: "Partido de prueba", localidad: "Localidad de prueba", geografia,
    };
    await page.route("**/api/financiadores/21/ficha-afiliado/?*", (route) => route.fulfill({ json: { ...lista([]), afiliado } }));
    await page.route("**/api/financiadores/21/padron/45/", (route) => route.fulfill({ json: afiliado }));
    await page.goto("/financiadores/padron/45?financiador=21");

    const domicilio = page.getByRole("region", { name: "Ficha administrativa del padrón" })
      .getByRole("region", { name: "Domicilio", exact: true });
    for (const [label, value, origin] of expected) {
      const field = domicilio.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) }).locator("..");
      await expect(field.getByRole("definition")).toContainText(value);
      await expect(field.getByRole("definition").getByText(origin, { exact: true })).toBeVisible();
    }
    await expect(domicilio.getByRole("definition").getByText("Sin informar", { exact: true })).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

    if (!geografia) {
      await domicilio.getByRole("button", { name: "Editar domicilio" }).press("Enter");
      const provincia = page.getByRole("dialog", { name: "Editar domicilio" }).getByRole("combobox", { name: "Provincia", exact: true });
      await expect(provincia).toHaveValue("Provincia de prueba");
      await expect(provincia).toHaveAccessibleDescription("Sin homologar");
    }
  });
}

test("abrir los resultados no cambia el tamaño de la tarjeta de domicilio", async ({ page }) => {
  await escenario(page);
  await page.goto("/pacientes?nuevo=1");
  const tarjeta = page.locator("section").filter({ has: page.getByRole("heading", { name: "Contacto y domicilio", exact: true }) });
  const antes = await tarjeta.boundingBox();
  await tarjeta.getByRole("combobox", { name: "Provincia", exact: true }).click();
  await expect(page.getByRole("listbox", { name: "Provincia", exact: true })).toBeVisible();
  const despues = await tarjeta.boundingBox();
  expect(Math.abs(despues.height - antes.height)).toBeLessThan(1);
});

for (const ancho of [390, 768, 1440]) {
  test.describe(`formularios a ${ancho}px`, () => {
    test.use({ viewport: { width: ancho, height: 900 }, colorScheme: ancho === 1440 ? "dark" : "light" });

    test("alta institucional envía el domicilio y su procedencia manual", async ({ page }) => {
      const escrituras = await escenario(page, false);
      await page.goto("/directorio");
      await page.getByRole("button", { name: /Nueva institución/ }).click();
      const dialogo = page.getByRole("dialog");
      await dialogo.getByRole("textbox", { name: /^Nombre/ }).fill("Institución nueva ficticia");
      await dialogo.getByRole("combobox", { name: /^Tipo/ }).selectOption({ label: "Hospital" });
      await provinciaManual(dialogo, "Provincia manual institucional", page);
      await dialogo.getByRole("button", { name: "Crear institución", exact: true }).click();
      await expect.poll(() => escrituras.find((r) => r.path === "/api/instituciones/")?.body.geografia).toEqual({ provincia: { manual: "Provincia manual institucional" }, partido: null, localidad: null });
    });

    test("alta de paciente conserva texto y manda ubicación manual", async ({ page }, testInfo) => {
      const escrituras = await escenario(page);
      await page.goto("/pacientes?nuevo=1");
      const dialogo = page;
      await dialogo.getByRole("textbox", { name: /^Nombre/ }).fill("Paciente ficticio");
      await dialogo.getByRole("textbox", { name: "Domicilio (opcional)", exact: true }).fill("Detalle de prueba");
      const identidad = await page.locator("section").filter({ has: page.getByRole("heading", { name: "Identidad", exact: true }) }).boundingBox();
      const contacto = await page.locator("section").filter({ has: page.getByRole("heading", { name: "Contacto y domicilio", exact: true }) }).boundingBox();
      expect(contacto.y).toBeGreaterThanOrEqual(identidad.y + identidad.height);
      expect(Math.abs(contacto.width - identidad.width)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`paciente-${ancho}.png`), fullPage: true });
      await page.locator("section").filter({ has: page.getByRole("heading", { name: "Contacto y domicilio", exact: true }) }).screenshot({ path: testInfo.outputPath(`domicilio-${ancho}.png`) });
      await provinciaManual(dialogo, "Provincia manual paciente");
      await dialogo.getByRole("button", { name: /Registrar paciente|Crear paciente|Registrar en padrón/ }).click();
      await expect.poll(() => escrituras.find((r) => r.path === "/api/ciudadanos/")?.body.geografia?.provincia).toEqual({ manual: "Provincia manual paciente" });
      expect(escrituras.find((r) => r.path === "/api/ciudadanos/").body.domicilio).toBe("Detalle de prueba");
    });

    test("alta de afiliación integra domicilio personal y laboral sin mezclar ubicación", async ({ page }) => {
      const escrituras = await escenario(page);
      await page.goto("/financiadores/padron/nuevo?financiador=21");
      await page.getByRole("textbox", { name: /^Número de documento/ }).fill("30123456");
      await page.getByRole("textbox", { name: /^Apellidos/ }).fill("Apellido ficticio");
      await page.getByRole("textbox", { name: /^Nombres/ }).fill("Nombre ficticio");
      await page.getByRole("textbox", { name: /^Número de afiliado/ }).fill("ISSUE136");
      await page.getByRole("button", { name: "Siguiente: Afiliación" }).click();
      await page.getByRole("combobox", { name: /^Plan/ }).selectOption("31");
      await page.getByRole("textbox", { name: /^Delegación/ }).fill("Sede ficticia");
      await page.getByRole("textbox", { name: /^Motivo del alta/ }).fill("Alta sintética de prueba");
      await page.getByRole("button", { name: /Siguiente: Contacto/ }).click();
      await provinciaManual(page, "Provincia personal");
      await page.getByRole("button", { name: /Siguiente: Situación laboral/ }).click();
      await page.getByRole("combobox", { name: /^Régimen/ }).selectOption("dependencia");
      await provinciaManual(page, "Provincia laboral");
      await page.getByRole("button", { name: "Registrar ahora", exact: true }).click();
      await expect.poll(() => escrituras.find((r) => r.path === "/api/financiadores/21/padron/")?.body.geografia_laboral?.provincia).toEqual({ manual: "Provincia laboral" });
      expect(escrituras.find((r) => r.path === "/api/financiadores/21/padron/").body.geografia.provincia).toEqual({ manual: "Provincia personal" });
    });
  });
}

for (const ancho of [390, 1440]) {
  for (const modo of ["paciente", "afiliación"]) {
    test(`búsqueda sin tilde en alta de ${modo} a ${ancho}px con teclado`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await escenario(page);
      await page.route("**/api/geografia/lugares/**", (route) => route.fulfill({ json: lista([{ id: 7, nombre: "Córdoba", origen: "georef" }]) }));
      if (modo === "paciente") {
        await page.goto("/pacientes?nuevo=1");
      } else {
        await page.goto("/financiadores/padron/nuevo?financiador=21");
        await page.getByRole("textbox", { name: /^Número de documento/ }).fill("30123456");
        await page.getByRole("textbox", { name: /^Apellidos/ }).fill("Apellido ficticio");
        await page.getByRole("textbox", { name: /^Nombres/ }).fill("Nombre ficticio");
        await page.getByRole("textbox", { name: /^Número de afiliado/ }).fill("ISSUE136");
        await page.getByRole("button", { name: "Siguiente: Afiliación" }).click();
        await page.getByRole("combobox", { name: /^Plan/ }).selectOption("31");
        await page.getByRole("textbox", { name: /^Delegación/ }).fill("Sede ficticia");
        await page.getByRole("textbox", { name: /^Motivo del alta/ }).fill("Alta sintética");
        await page.getByRole("button", { name: /Siguiente: Contacto/ }).click();
      }
      const campo = page.getByRole("combobox", { name: "Provincia", exact: true }).first();
      await campo.fill("cordo");
      await expect(page.getByRole("option", { name: "Córdoba", exact: true })).toBeVisible();
      await campo.press("ArrowDown");
      await campo.press("Enter");
      await expect(campo).toHaveValue("Córdoba");
    });
  }
}
