import test from "node:test";
import assert from "node:assert/strict";
import { parametrosFicha, parametrosFamiliar, parametrosListado } from "./padronNavigation.js";

test("ficha state stays in its ficha and never leaks into padron or another person", () => {
  const query = "financiador=7&estado=administrativas&padron_page=3&page=4&tab=derechos&autorizaciones_page=2&historial_page=5";
  assert.deepEqual(Object.fromEntries(parametrosListado(query, 7)), {
    financiador: "7", estado: "administrativas", page: "3",
  });
  for (const target of [parametrosFamiliar(query), parametrosFicha(query, 7, 3)]) {
    for (const field of ["autorizaciones_page", "historial_page", "page", "tab"]) {
      assert.equal(target.has(field), false, field);
    }
    assert.equal(target.get("estado"), "administrativas");
    assert.equal(target.get("padron_page"), "3");
  }
});

test("el retorno conserva filtros y página del padrón, sin páginas de otro afiliado", () => {
  const listado = new URLSearchParams("financiador=7&search=00100&plan=3&page=4&administrativo=en_tramite&alta_desde=2026-01-01");
  const ficha = parametrosFicha(listado, 7, 4);
  ficha.set("page", "8");
  ficha.set("autorizaciones_page", "3");
  ficha.set("historial_page", "2");
  const familiar = parametrosFamiliar(ficha);
  assert.equal(familiar.get("page"), null);
  assert.equal(familiar.get("autorizaciones_page"), null);
  assert.equal(familiar.get("historial_page"), null);
  assert.deepEqual(Object.fromEntries(parametrosListado(familiar, 7)), Object.fromEntries(listado));
  assert.equal(ficha.get("page"), "8", "no muta la URL original");
});

test("la primera página no hereda la página previa del padrón", () => {
  const query = parametrosFicha(new URLSearchParams("padron_page=9&page=1"), 2, 1);
  assert.equal(query.get("padron_page"), null);
  assert.equal(parametrosListado(query, 2).get("page"), null);
});
