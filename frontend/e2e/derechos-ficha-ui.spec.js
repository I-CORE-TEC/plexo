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
    return route.fulfill({ json: data });
  });
  return consultas;
}

test("Derechos integrado fija persona, registra sin búsqueda y limpia contexto al salir", async ({ page }) => {
  const consultas = await escenario(page);
  await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&afiliado=99");
  const panel = page.getByRole("tabpanel", { name: "Derechos", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("region", { name: "Situación de afiliación" })).toContainText("Persona Ficticia");
  await expect(page.getByRole("navigation", { name: "Menú del financiador" }).getByRole("link", { name: "Derechos", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Quitar filtro de persona" })).toHaveCount(0);
  await expect.poll(() => consultas.filter((url) => url.includes("/novedades/?"))).toContain("/api/financiadores/21/novedades/?page=1&afiliado=45");
  await panel.getByRole("button", { name: "Registrar novedad" }).click();
  await expect(page.getByRole("combobox", { name: "Persona del padrón" })).toHaveValue("45");
  await expect(page.getByRole("combobox", { name: "Persona del padrón" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const tab = page.getByRole("tab", { name: "Derechos", exact: true });
  await tab.focus(); await page.keyboard.press("Enter");
  await expect(tab).toBeFocused();
  await page.getByRole("tab", { name: "Historial", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("afiliado")).toBe(false);
  await page.getByRole("tab", { name: "Derechos", exact: true }).click();
  await page.reload();
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("auditor consulta sin acciones y una persona u organización ajena no monta novedades", async ({ page }) => {
  const consultas = await escenario(page, "auditor");
  await page.goto("/financiadores/padron/45?financiador=21&tab=derechos");
  await expect(page.getByRole("tabpanel", { name: "Derechos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar novedad" })).toHaveCount(0);
  await expect.poll(() => consultas.filter((u) => u.includes("/novedades/")).length).toBe(1);
  const previas = consultas.filter((u) => u.includes("/novedades/")).length;
  await page.goto("/financiadores/padron/999?financiador=21&tab=derechos");
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(consultas.filter((u) => u.includes("/novedades/")).length).toBe(previas);
  await page.goto("/financiadores/padron/45?financiador=22&tab=derechos");
  await expect(page.getByText("No tenés acceso al financiador seleccionado")).toBeVisible();
  expect(consultas.some((u) => u.startsWith("/api/financiadores/22/"))).toBe(false);
});

test("enlace antiguo conserva búsqueda y contexto por persona", async ({ page }) => {
  await escenario(page);
  await page.goto("/financiadores/derechos?financiador=21&afiliado=45");
  await expect(page.getByRole("heading", { name: "Derechos por persona" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Situación de afiliación" })).toContainText("Persona Ficticia");
  await expect(page.getByRole("button", { name: "Buscar persona", exact: true })).toBeVisible();
});

function propuesta(id=81, afiliado=45, estado="pendiente") {
 const persona={id:afiliado,documento:"90000045",nombre:"Persona Ficticia",revision:1,cobertura_habilitada:false};
 return {id,estado,revision:1,original:{afiliado,fuente:"Test",referencia:"Evidencia",codigo:"A",descripcion:"Evidencia de prueba"},persona_actual:persona,persona_inicial:persona,conflictos:[],coincidencias:[],historia:[]};
}
test("novedad ajena oculta evidencia y acciones", async ({page})=>{
 await escenario(page);
 await page.route("**/novedades/81/",r=>r.fulfill({json:propuesta(81,99)}));
 await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&afiliado=99&novedad=81");
 await expect(page.getByRole("alert")).toContainText("La novedad no corresponde");
 await expect(page.getByRole("region",{name:"Evidencia original"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Registrar rectificación"})).toHaveCount(0);
 await page.getByRole("button",{name:"Limpiar selección"}).click();
 expect(new URL(page.url()).searchParams.get("afiliado")).toBe("45");
});
test("borradores no sobreviven cambio de pestaña ni novedad",async({page})=>{
 await escenario(page);
 await page.route("**/novedades/81/",r=>r.fulfill({json:propuesta()}));
 await page.route("**/novedades/82/",r=>r.fulfill({json:propuesta(82)}));
 await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&novedad=81");
 await page.getByRole("textbox",{name:"Motivo de la decisión"}).fill("Borrador no transferible");
 await page.getByRole("button",{name:"Cerrar",exact:true}).first().click();
 await page.evaluate(()=>{history.pushState({},"","?financiador=21&tab=derechos&novedad=82");dispatchEvent(new PopStateEvent("popstate"));});
 await expect(page.getByRole("textbox",{name:"Motivo de la decisión"})).toHaveValue("");
 await page.getByRole("button",{name:"Cerrar",exact:true}).first().click();
 await page.getByRole("button",{name:"Registrar novedad",exact:true}).click();
 await page.getByRole("textbox",{name:"Fuente",exact:true}).fill("Test");
 await page.getByRole("tab",{name:"Historial",exact:true}).evaluate(e=>e.click());
 await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.getByRole("tab",{name:"Derechos",exact:true}).click();
 await page.getByRole("button",{name:"Registrar novedad",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Fuente",exact:true})).toHaveValue("");
});
test("decisión refresca resumen y conserva enlaces de ficha e historial",async({page})=>{
 await escenario(page);
 let habilitada=false,consultas=0;
 await page.route("**/ficha-afiliado/**",r=>{consultas++; return r.fulfill({json:{...lista([]),afiliado:{id:45,numero:"00045",documento:"90000045",nombre:"Persona Ficticia",desde:"2020-01-01",vigente:true,cobertura_habilitada:habilitada,plan:31},historial:[],resumen:{},cupos:[]}});});
 let novedad=propuesta(81,45,"conciliada");
 await page.route("**/novedades/81/",r=>r.fulfill({json:novedad}));
 await page.route("**/novedades/81/habilitacion-cobertura/",async r=>{
 expect(r.request().postDataJSON().cobertura_habilitada).toBe(true); habilitada=true;
 novedad={...novedad,persona_actual:{...novedad.persona_actual,cobertura_habilitada:true,revision:2},habilitacion_cobertura:{resultado:"cambiada",cobertura_habilitada:true,motivo:"Prueba",historial_id:66}};
 return r.fulfill({json:novedad});
 });
 await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&novedad=81");
 await page.getByRole("combobox",{name:"Estado de cobertura"}).selectOption("habilitar");
 await page.getByRole("textbox",{name:"Motivo de la decisión"}).fill("Prueba");
 const previas=consultas;
 await page.getByRole("button",{name:"Aplicar decisión de cobertura"}).click();
 await expect(page.getByText("Cobertura actualizada",{exact:false})).toBeVisible();
 await expect.poll(()=>consultas).toBeGreaterThan(previas);
 await expect(page.getByRole("link",{name:"Ver historial",exact:true})).toHaveAttribute("href","/financiadores/padron/45?financiador=21&tab=historial");
 await page.getByRole("button",{name:"Cerrar",exact:true}).first().click();
 await expect(page.getByRole("region",{name:"Situación de afiliación"})).toContainText("Habilitada");
});

test("POST registra siempre persona de ruta aunque query y select DOM intenten cambiarla",async({page})=>{
 await escenario(page);let payload;
 await page.route("**/novedades/",async r=>{if(r.request().method()==='POST'){payload=r.request().postDataJSON();return r.fulfill({json:propuesta()});} return r.fallback();});
 await page.route("**/novedades/81/",r=>r.fulfill({json:propuesta()}));
 await page.goto("/financiadores/padron/45?financiador=21&tab=derechos&afiliado=99");
 await page.getByRole("button",{name:"Registrar novedad",exact:true}).click();
 await page.getByRole("combobox",{name:"Persona del padrón"}).evaluate(el=>{el.disabled=false;el.add(new Option('Otra','99'));el.value='99';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.getByRole("textbox",{name:"Fuente",exact:true}).fill("Test");
 await page.getByRole("textbox",{name:"Descripción administrativa"}).fill("Evidencia sintética");
 await page.getByRole("textbox",{name:"Motivo del registro"}).fill("Verificación");
 await page.getByRole("button",{name:"Guardar propuesta"}).click();
 await expect.poll(()=>payload?.afiliado).toBe(45);
});
