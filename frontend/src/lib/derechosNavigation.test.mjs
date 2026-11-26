import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRightsAffiliateUrl,
  parseRightsNavigation,
  redirectRetiredNoveltyUrl,
  updateRightsNavigation,
} from "./derechosNavigation.js";

test("parses only positive integer affiliate identifiers", () => {
  assert.deepEqual(parseRightsNavigation("?financiador=42&afiliado=8"), { affiliateId: 8, invalid: null });
  assert.deepEqual(parseRightsNavigation("?financiador=42"), { affiliateId: null, invalid: null });
  assert.equal(parseRightsNavigation("?afiliado=8x").invalid, "afiliado");
  assert.equal(parseRightsNavigation("?afiliado=0").invalid, "afiliado");
  assert.equal(parseRightsNavigation("?afiliado=2.5").invalid, "afiliado");
});

test("selecting or clearing a person preserves the organization and search context", () => {
  const selected = updateRightsNavigation("?financiador=42&buscar=perez&padron_page=3", { affiliateId: 8 });
  assert.equal(selected.get("financiador"), "42");
  assert.equal(selected.get("buscar"), "perez");
  assert.equal(selected.get("padron_page"), "3");
  assert.equal(selected.get("afiliado"), "8");
  const cleared = updateRightsNavigation(selected, { affiliateId: null });
  assert.equal(cleared.has("afiliado"), false);
  assert.equal(cleared.get("financiador"), "42");
});

test("builds the affiliate ficha URL with exact organization and person identity", () => {
  assert.equal(buildRightsAffiliateUrl({ financierId: 42, affiliateId: 8 }), "/financiadores/padron/8?financiador=42");
  assert.equal(buildRightsAffiliateUrl({ financierId: 42, affiliateId: 8, tab: "historial" }),
    "/financiadores/padron/8?financiador=42&tab=historial");
  assert.equal(buildRightsAffiliateUrl({ financierId: 42, affiliateId: "8x" }), null);
});

test("old Novedades deep links redirect to the person's history or to the padron", () => {
  assert.equal(redirectRetiredNoveltyUrl("?financiador=42&afiliado=8&novedad=91&estado=conciliada&page=2"),
    "/financiadores/padron/8?financiador=42&tab=historial");
  assert.equal(redirectRetiredNoveltyUrl("?financiador=42&estado=pendiente"), "/financiadores/padron?financiador=42");
  assert.equal(redirectRetiredNoveltyUrl("?financiador=42&afiliado=0&novedad=91"), "/financiadores/padron?financiador=42");
  assert.equal(redirectRetiredNoveltyUrl("?financiador=x&afiliado=8"), "/financiadores/padron");
  assert.equal(redirectRetiredNoveltyUrl(""), "/financiadores/padron");
});
