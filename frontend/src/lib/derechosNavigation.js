function idPositivo(valor) {
  if (!/^[1-9]\d*$/.test(String(valor ?? ""))) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : null;
}

export function parseRightsNavigation(search) {
  const params = new URLSearchParams(search);
  if (!params.has("afiliado")) return { affiliateId: null, invalid: null };
  const affiliateId = idPositivo(params.get("afiliado"));
  return { affiliateId, invalid: affiliateId == null ? "afiliado" : null };
}

export function updateRightsNavigation(search, { affiliateId = null }) {
  const params = new URLSearchParams(search);
  if (affiliateId == null) params.delete("afiliado");
  else params.set("afiliado", String(affiliateId));
  return params;
}

export function buildRightsAffiliateUrl({ financierId, affiliateId, tab = "datos" }) {
  const financier = idPositivo(financierId);
  const affiliate = idPositivo(affiliateId);
  if (financier == null || affiliate == null) return null;
  const params = new URLSearchParams({ financiador: String(financier) });
  if (tab && tab !== "datos") params.set("tab", tab);
  return `/financiadores/padron/${affiliate}?${params}`;
}

// La pantalla manual de Novedades fue retirada (#219). Sus enlaces viejos
// llevan al historial de la persona, donde los registros siguen visibles
// como texto de sólo lectura; sin persona válida, al padrón del financiador.
export function redirectRetiredNoveltyUrl(search) {
  const params = new URLSearchParams(search);
  const financier = idPositivo(params.get("financiador"));
  const ficha = buildRightsAffiliateUrl({ financierId: financier, affiliateId: params.get("afiliado"), tab: "historial" });
  if (ficha) return ficha;
  return financier == null ? "/financiadores/padron" : `/financiadores/padron?financiador=${financier}`;
}
