import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRightsNoveltyUrl,
  parseRightsNavigation,
  updateRightsNavigation,
} from "./derechosNavigation.js";

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
