# Issue #219 — Monthly OSTEL roster import (simplified scope)

Objective: import the monthly OSTEL roster, show what changed in five groups, apply it per group with audit trail, and review manually only real conflicts.
Branch: `feat/issue-219-padron-mensual` (base `origin/main` e93ec13). Delivery: single PR at the end against `main`; production untouched. Test runner: Django `manage.py test` (SQLite local) + Vitest/node tests + Playwright (`playwright.financiadores-ui.config.js` intercepted API, plus one real journey).

## Specs

- **S1 — Five groups in preview.** Quoted from the issue comment (26/11/2026): "Un solo flujo mensual sobre el importador existente: "Importar padrón OSTEL del mes", con una vista previa agrupada en: Altas. Modificaciones: antes y después por campo. Bajas: solo filas con FECBAJ o ESTADO=B. La ausencia en el lote **no** genera baja. Reingresos: movimiento R o afiliado finalizado. Conflictos: identidad, duplicados o fechas inconsistentes."
  - The real file has no R movement code (`TIPO` is A/P category), so reingreso = an existing finalized afiliado appears in the file without FECBAJ/ESTADO=B.
- **S2 — Apply per group in one step.** "Aplicar por grupo en un paso, reutilizando `registrar_afiliado`, `editar_ficha`, `finalizar_afiliacion` y `reactivar_afiliacion`, con el lote como origen auditado. Las filas limpias no requieren un motivo por fila. Baja = FECBAJ como fin administrativo. **Nunca** FECVTO." "Mientras tanto, aplicar bajas requiere la confirmación explícita del operador por lote."
- **S3 — Manual review only for conflicts.** "Revisión manual solo para conflictos, en la misma pantalla del lote, reutilizando `subsanar`."
- **S4 — Retire manual Novedades UI.** "Congelar Novedades manual: sin funciones nuevas." User decision D3: hide the global tab and remove the embedded version in Derechos with its navigation layer; existing records stay as read-only history, no migration.
- **S5 — Done criteria.** "Se importa un padrón mensual de ejemplo, se ven los cinco grupos, se aplican altas, modificaciones, bajas y reingresos con historial, y los conflictos quedan para revisión manual. Hay tests del flujo y un recorrido real de UI. La documentación es una página corta."
- **Decisions (user, 26/11/2026):**
  - D1: baja cut date = the file's FECBAJ (even if past). `finalizar_afiliacion` gains an optional date; manual path keeps current behavior.
  - D2: reingreso reactivates with the afiliado's previous plan, `desde` = FECING of the row. Previous plan missing/inactive, or FECING missing/future → conflict.
  - D3: see S4.
- **Out of scope:** causales catalog, source precedence, overlapping periods, #216 grace/mora/subsidies, SSSalud/ARCA/ANSES.
- **Assumptions (reversible):** coverage ends at the end of the FECBAJ day (local 23:59:59); FECBAJ in the future → conflict; ESTADO=B without FECBAJ → conflict (no cut date); altas keep current `desde = today` behavior.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1+T2 | S1, S2, S3 (backend) | delegated writer A (parallel with T4) | done 97c3c67, verifier PASS | test_ostel_grupos 23 tests; suite 919, same 4 base failures |
| T4 | S4 | delegated writer B (parallel with T1+T2) | done 06766ac | node tests 7/7, vite build ok, derechos-ficha e2e 10/10 (Chrome channel) |
| T3 | S1, S2, S3 (frontend) | delegated writer C | done | mocked 12/12, real 10/10, visible demo |
| T5 | S5 | parent | done | docs + PR |

Risk: T1+T2 item 1 (bulk changes to existing stored afiliados) → independent verifier.

## Log

- L1 (26/11/2026, user): "orquesta la implementacion" — after approving the simplified plan in the #219 comment "Pedido de simplificación — frenar y replantear antes de continuar" and decisions D1–D3, single PR at the end.
- L2: Parallel writers A (backend) and B (frontend Novedades retirement) launched with disjoint surfaces.
- L3: Writer B finished T4. Old `/financiadores/novedades` links redirect to the person's padrón history (or padrón list). Deleted specs novedades-gestion-ui, novedades-real, derechos-conjunto-real and config `playwright.novedades-gestion.config.js`; parent cleaned testMatch in derechos-real/conjunto/cierre configs. Unavailable: eslint (no project config); real-backend e2e not run. Pending docs: novedades-gestion-manual.md, derechos-aceptacion-conjunta.md. Risk: item 3 (public route removed; mitigated by redirect).
- L4: Writer A finished T1+T2. Deviation accepted: `Importacion.version` stays 3 (8 consumers check it); new lots carry `resumen.contrato = 4`; old lots readable, not applicable via `aplicar-ostel`. API: `aplicar-ostel/` {importacion, grupos, motivo, confirmar_bajas}. Correction sent: conflicts for FECBAJ < afiliado.desde and reingreso FECING ≤ previous baja. Writer C launched for T3. Parent wrote docs: new `padron-mensual-ostel.md`, retired `novedades-gestion-manual.md`, note in `derechos-aceptacion-conjunta.md`.
- L5: Writer C finished T3 (mocked ostel-mensual-ui 12/12 desktop+mobile, financiadores-ui 82/82, node tests 14/14, vite build ok). Parent fixed `familia-ostel-real.spec.js` for the new flow (a re-imported case is a modificación). Real browser+API+PostgreSQL (`playwright.importacion-real.config.js`, disposable Docker postgres:16 on 127.0.0.1:55519, installed Chrome): 10/10 passed. T4 committed 06766ac. RDD globally off → no native review; independent verifier for T1+T2 in progress.
- L6: Independent verifier: S1–S3 PASS, no blockers; 5 probes added as regression tests (31/31). Advisories kept open: old `confirmar-importacion` still applies altas/modificaciones on contract-4 lots without lot motivo (UI no longer uses it); repeated bajas of already-finalized afiliados become conflicts (product question). Visible real-browser demo on disposable Postgres with a five-group fictitious file: all groups applied; DB shows baja finalizado_en 31/10/2026 23:59, reingreso desde FECING with previous plan, conflict untouched, lot motivo in history. Fixed during demo: lot motivo field collapsed to 20px (theme overrides `max-w-xl`), ISO dates in diffs now DD/MM/AAAA. Mobile 390px: no page overflow. Observation: an existing afiliado whose coverage differs from the lot's "Habilitar cobertura" option is a conflict (pre-existing rule).
- L7 (27/11/2026, user): "quiero que tomemos las 3 decisiones y creemos un pr para implementarla". Decisions: (1) "Misma fecha: ignorar" — repeated baja with the same date is `ya_registrada` (estado aplicada, no review); other date stays a conflict. (2) "No es conflicto" — in the monthly OSTEL flow the lot coverage option only governs altas; existing afiliados keep theirs without conflict (generic importer unchanged). (3) First "Rechazar lotes mensuales"; after learning it broke 46 tests and the lightweight batched response, user chose "Exigir motivo del lote": `confirmar-importacion` keeps working for contract-4 lots but requires the lot `motivo`. Branch `fix/issue-219-decisiones` from main cba352e.
