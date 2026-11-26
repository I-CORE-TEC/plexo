import test from "node:test";
import assert from "node:assert/strict";
import { GRUPOS, aplicarGrupo, esMensual, etiquetaCampo, filasDelGrupo, grupoDe, motivoValido, pendientesDe } from "./ostelMensual.js";

const fila = (n, grupo, estado = "valida") => ({ fila: n, grupo, estado });

test("los cinco grupos mantienen el orden del lote mensual", () => {
  assert.deepEqual(GRUPOS.map((g) => g.label), ["Altas", "Modificaciones", "Bajas", "Reingresos", "Conflictos"]);
  assert.equal(GRUPOS.find((g) => g.key === "conflicto").accion, undefined);
});

test("agrupa sin contar excluidas y trata la revisión sin grupo como conflicto", () => {
  const filas = [fila(1, "alta"), fila(2, "alta", "aplicada"), fila(3, "alta", "omitida"), fila(4, "baja"), fila(5, undefined, "revision")];
  assert.equal(grupoDe(filas[4]), "conflicto");
  assert.deepEqual(filasDelGrupo(filas, "alta").map((f) => f.fila), [1, 2]);
  assert.deepEqual(filasDelGrupo(filas, "conflicto").map((f) => f.fila), [5]);
});

test("sólo el contrato 4 es un lote mensual", () => {
  assert.equal(esMensual({ resumen: { contrato: 4 } }), true);
  assert.equal(esMensual({ resumen: { valida: 1 } }), false);
  assert.equal(esMensual(null), false);
  assert.equal(pendientesDe({ resumen: { pendientes: { alta: 3 } } }, "alta"), 3);
  assert.equal(pendientesDe({ resumen: {} }, "baja"), 0);
});

test("el motivo del lote es obligatorio y de hasta 255 caracteres", () => {
  assert.equal(motivoValido("  "), false);
  assert.equal(motivoValido("Padrón de noviembre"), true);
  assert.equal(motivoValido("x".repeat(256)), false);
});

test("los campos se muestran con su nombre visible", () => {
  assert.equal(etiquetaCampo("nombre"), "Nombre completo");
  assert.equal(etiquetaCampo("codigo_postal"), "Código postal");
  assert.equal(etiquetaCampo("desconocido"), "desconocido");
});

const lote = (pendientes) => ({ id: 1, resumen: { contrato: 4, pendientes: { alta: pendientes } } });

test("aplica tandas hasta vaciar los pendientes del grupo", async () => {
  const restantes = [150, 50, 0];
  const vistos = [];
  const final = await aplicarGrupo(lote(250), "alta", async () => lote(restantes.shift()), (l) => vistos.push(pendientesDe(l, "alta")));
  assert.deepEqual(vistos, [150, 50, 0]);
  assert.equal(pendientesDe(final, "alta"), 0);
});

test("se detiene si una tanda no avanza", async () => {
  let llamadas = 0;
  const final = await aplicarGrupo(lote(5), "alta", async () => { llamadas += 1; return lote(5); });
  assert.equal(llamadas, 1);
  assert.equal(pendientesDe(final, "alta"), 5);
});

test("no envía nada sin pendientes y propaga el error", async () => {
  let llamadas = 0;
  await aplicarGrupo(lote(0), "alta", async () => { llamadas += 1; return lote(0); });
  assert.equal(llamadas, 0);
  await assert.rejects(aplicarGrupo(lote(2), "alta", async () => { throw new Error("400"); }), /400/);
});
