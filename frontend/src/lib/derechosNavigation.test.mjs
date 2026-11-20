import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRightsNoveltyUrl,
  parseRightsNavigation,
  updateRightsNavigation,
} from "./derechosNavigation.js";

test("embedded novelty filters and pages never consume ficha or padron parameters", () => {
  const options = { embedded: true };
  const original = "financiador=42&afiliado=8&estado=administrativas&page=4&padron_page=3";
  assert.equal(parseRightsNavigation(original, options).page, 1);
  const filtered = updateRightsNavigation(original, { status: "conciliada" }, options);
  const paged = updateRightsNavigation(filtered, { page: 2 }, options);
  assert.equal(paged.get("estado"), "administrativas");
  assert.equal(paged.get("page"), "4");
  assert.equal(paged.get("padron_page"), "3");
  assert.equal(paged.get("novedades_estado"), "conciliada");
  assert.equal(paged.get("novedades_page"), "2");
  assert.deepEqual(parseRightsNavigation(paged, options), {
    affiliateId: 8, noveltyId: null, status: "conciliada", page: 2, invalid: null,
  });
  const changed = updateRightsNavigation(paged, { status: "pendiente" }, options);
  assert.equal(changed.has("novedades_page"), false);
  assert.equal(changed.get("page"), "4");
  const person = updateRightsNavigation(`${paged}&novedad=91`, { affiliateId: 9 }, options);
  assert.equal(person.has("novedad"), false);
  assert.equal(person.has("novedades_page"), false);
  assert.equal(person.get("page"), "4");
});

test("parses only positive integer identifiers and retains the list context", () => {
  assert.deepEqual(parseRightsNavigation("?financiador=42&afiliado=8&novedad=91&estado=conciliada&page=3"), {
    affiliateId: 8,
    noveltyId: 91,
    status: "conciliada",
    page: 3,
    invalid: null,
  });
});

test("malformed affiliate or novelty identifiers are rejected without coercion", () => {
  assert.equal(parseRightsNavigation("?afiliado=8x").invalid, "afiliado");
  assert.equal(parseRightsNavigation("?novedad=0").invalid, "novedad");
  assert.equal(parseRightsNavigation("?novedad=2.5").invalid, "novedad");
});

test("changing the status resets pagination and preserves unrelated query context", () => {
  const query = updateRightsNavigation("?financiador=42&afiliado=8&estado=pendiente&page=4", {
    status: "conciliada",
  });
  assert.equal(query.get("financiador"), "42");
  assert.equal(query.get("afiliado"), "8");
  assert.equal(query.get("estado"), "conciliada");
  assert.equal(query.has("page"), false);
});

test("clearing the selected novelty preserves the person filter and organization", () => {
  const query = updateRightsNavigation("?financiador=42&afiliado=8&novedad=91&page=2", {
    noveltyId: null,
  });
  assert.equal(query.get("financiador"), "42");
  assert.equal(query.get("afiliado"), "8");
  assert.equal(query.has("novedad"), false);
  assert.equal(query.get("page"), "2");
});

test("builds a read-only navigation URL with exact organization and person identity", () => {
  assert.equal(buildRightsNoveltyUrl({ financierId: 42, affiliateId: 8, noveltyId: 91 }),
    "/financiadores/novedades?financiador=42&afiliado=8&novedad=91");
  assert.equal(buildRightsNoveltyUrl({ financierId: 42 }), "/financiadores/novedades?financiador=42");
});
