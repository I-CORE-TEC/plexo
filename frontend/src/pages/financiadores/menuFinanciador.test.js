import test from "node:test";
import assert from "node:assert/strict";
import { accesoFinanciador, itemsFinanciador, puedeAccederBorradoresLegados } from "./menuFinanciador.js";

const plataforma = { capacidades_por_institucion: { global: ["gobierno_plataforma"] } };
const menu = (organizacion, opciones = {}) => itemsFinanciador({ organizacion, plataforma: false, sufijo: "?financiador=7", ...opciones });

test("plataforma sin membresía sólo dispone del catálogo común", () => {
  assert.deepEqual(menu({ rol: null }, { plataforma: true }).map((item) => item.key), ["catalogo"]);
  assert.deepEqual(menu(null, { plataforma: true }).map((item) => item.to), ["/financiadores/catalogo"]);
});

test("el primer admin requiere la capacidad explícita del servidor", () => {
  const organizacion = { rol: null, puede_designar_admin_inicial: true };
  assert.deepEqual(menu(organizacion, { plataforma: true }).map((item) => item.key), ["usuarios", "catalogo"]);
  assert.equal(menu(organizacion).length, 0);
  assert.deepEqual(menu({ rol: null, puede_designar_admin_inicial: "true" }, { plataforma: true }).map((item) => item.key), ["catalogo"]);
});

test("los miembros conservan su rol aunque también pertenezcan a plataforma", () => {
  for (const rol of ["admin", "operador", "auditor"]) {
    const organizacion = { rol };
    const acceso = accesoFinanciador(plataforma, organizacion);
    assert.equal(acceso.admin, rol === "admin");
    assert.equal(acceso.operador, rol !== "auditor");
    const items = menu(organizacion, { plataforma: true, admin: true });
    assert.equal(items.some((item) => item.key === "usuarios"), rol === "admin");
    assert.ok(items.some((item) => item.key === "padron"));
  }
});

test("un argumento admin heredado no concede operaciones sin membresía", () => {
  assert.deepEqual(menu({ rol: null }, { plataforma: true, admin: true }).map((item) => item.key), ["catalogo"]);
  assert.equal(menu({ rol: "desconocido" }).length, 0);
});

test("plataforma con membresía no-admin conserva bootstrap acotado si está habilitado", () => {
  for (const rol of ["operador", "auditor"]) {
    assert.ok(menu({ rol, puede_designar_admin_inicial: true }, { plataforma: true }).some((item) => item.key === "usuarios"));
    assert.equal(accesoFinanciador(plataforma, { rol, puede_designar_admin_inicial: true }).admin, false);
    assert.equal(menu({ rol, puede_designar_admin_inicial: false }, { plataforma: true }).some((item) => item.key === "usuarios"), false);
  }
});

test("superusuario efectivo conserva administración técnica", () => {
  assert.equal(accesoFinanciador({ is_superuser: true }, { rol: "admin" }).admin, true);
  assert.ok(menu({ rol: "admin" }, { plataforma: true }).some((item) => item.key === "usuarios"));
});

test("Ver como usa la identidad efectiva sin sumar al superusuario real", () => {
  const simulado = { is_superuser: false, simulacion: { superusuario: { is_superuser: true } } };
  assert.deepEqual(accesoFinanciador(simulado, { rol: "auditor" }), { plataforma: false, admin: false, operador: false });
  assert.deepEqual(accesoFinanciador(simulado, { rol: "operador" }), { plataforma: false, admin: false, operador: true });
});

test("sin organización no se muestran secciones operativas", () => {
  assert.deepEqual(menu(null), []);
  assert.ok(menu({ rol: "auditor" }).every((item) => item.to.endsWith("?financiador=7")));
});

test("Derechos reemplaza a Borradores como entrada operativa para cada miembro", () => {
  for (const rol of ["admin", "operador", "auditor"]) {
    const keys = menu({ rol }).map((item) => item.key);
    assert.ok(keys.includes("derechos"));
    assert.equal(keys.includes("borradores"), false);
    assert.ok(menu({ rol }).find((item) => item.key === "derechos").to.endsWith("?financiador=7"));
  }
  assert.equal(menu({ rol: null }).some((item) => item.key === "derechos"), false);
  assert.equal(menu({ rol: "desconocido" }).some((item) => item.key === "derechos"), false);
});

test("la URL histórica de Borradores sólo conserva acceso de miembros reconocidos", () => {
  for (const rol of ["admin", "operador", "auditor"]) assert.equal(puedeAccederBorradoresLegados({ rol }), true);
  for (const organizacion of [null, {}, { rol: null }, { rol: "desconocido" }]) assert.equal(puedeAccederBorradoresLegados(organizacion), false);
});
