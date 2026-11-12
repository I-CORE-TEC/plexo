const ESTADOS_NOVEDAD = new Set(["pendiente", "conciliada", "descartada"]);

function idPositivo(valor) {
  if (!/^[1-9]\d*$/.test(String(valor ?? ""))) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : null;
}

export function parseRightsNavigation(search) {
  const params = new URLSearchParams(search);
  const id = (campo) => {
    if (!params.has(campo)) return { value: null, invalid: false };
    const value = idPositivo(params.get(campo));
    return { value, invalid: value == null };
  };
  const affiliate = id("afiliado");
  const novelty = id("novedad");
  const requestedStatus = params.get("estado") || "";
  const requestedPage = idPositivo(params.get("page") || "1");

  return {
    affiliateId: affiliate.value,
    noveltyId: novelty.value,
    status: ESTADOS_NOVEDAD.has(requestedStatus) ? requestedStatus : "",
    page: requestedPage || 1,
    invalid: affiliate.invalid ? "afiliado" : novelty.invalid ? "novedad" : null,
  };
}

export function updateRightsNavigation(search, updates) {
  const params = new URLSearchParams(search);
  const previous = parseRightsNavigation(params);
  const affiliateChanged = Object.hasOwn(updates, "affiliateId") && updates.affiliateId !== previous.affiliateId;
  const statusChanged = Object.hasOwn(updates, "status") && updates.status !== previous.status;

  if (affiliateChanged || statusChanged) params.delete("page");
  if (affiliateChanged) params.delete("novedad");

  const fields = { affiliateId: "afiliado", noveltyId: "novedad", status: "estado", page: "page" };
  for (const [key, value] of Object.entries(updates)) {
    const field = fields[key];
    if (!field) continue;
    if (value == null || value === "" || value === 1 && key === "page") params.delete(field);
    else params.set(field, String(value));
  }
  return params;
}

export function buildRightsNoveltyUrl({ financierId, affiliateId = null, noveltyId = null, status = "", page = 1 }) {
  const financier = idPositivo(financierId);
  if (financier == null) return null;

  const params = new URLSearchParams({ financiador: String(financier) });
  const affiliate = affiliateId == null ? null : idPositivo(affiliateId);
  const novelty = noveltyId == null ? null : idPositivo(noveltyId);
  if (affiliate != null) params.set("afiliado", String(affiliate));
  if (novelty != null) params.set("novedad", String(novelty));
  if (ESTADOS_NOVEDAD.has(status)) params.set("estado", status);
  const pageNumber = idPositivo(page);
  if (pageNumber != null && pageNumber > 1) params.set("page", String(pageNumber));
  return `/financiadores/novedades?${params}`;
}

export function buildRightsAffiliateUrl({ financierId, affiliateId, tab = "datos" }) {
  const financier = idPositivo(financierId);
  const affiliate = idPositivo(affiliateId);
  if (financier == null || affiliate == null) return null;
  const params = new URLSearchParams({ financiador: String(financier) });
  if (tab && tab !== "datos") params.set("tab", tab);
  return `/financiadores/padron/${affiliate}?${params}`;
}
