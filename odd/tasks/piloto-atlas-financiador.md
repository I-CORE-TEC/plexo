# PLEXO live atlas pilot
Branch: `juanikitro/Issues-4` · Baseline: `0daa979` · Delivery: local only, ask-on-risk for future PR.
Verification: isolated Python 3.12 CLI tests, local Chrome visual check, independent CI verification.

## Specs
- S1. User intent: «quiero que hagamos que esto sea mejor aun, para que nos sirva de aca en adelante, ademas de que se mantenga solo con las implementaciones que hacemos con ia y eso, como podriamos hacer?» Approved with «si» to «¿Arrancamos con ese piloto y dejamos los otros recorridos como referencia hasta probar que el mecanismo de actualización funciona?». Retain the standalone HTML atlas and its classic graphical navigation. Maintain the covering/authorization/realization journey; keep the other flows as reference.
- S2. Preserve the accepted pilot’s «avisos, sin bloquear PR ni publicar el atlas automáticamente». Check observable flow changes in the same PR, allow documented no-impact decisions, and build HTML deterministically without a publish/deploy operation. Only local implementation and verification were authorized here.

## Tasks
- T1 — S1–S2 · inline implementation and independent verification · locally verified at `456b6dc`; GitHub runner not exercised. Risk: item 5 (new isolated CI workflow, advisory only).

## Log
- L1 — «si», in reply to the pilot proposal cited in S1. No remote delivery or use of real data.
- L2 — The original atlas exists only in a prior chat artifact. Carry it forward as a reference snapshot; extract only the two chapters that implement the selected journey. Realization is within Cobertura y copago. Keep stable chapter IDs.
- L3 — RDD read-only mode status reported global off (clone unset). Do not change that preference; native lifecycle is not entered.
- L4 — Docker Python 3.12: RED failed because the CLI did not yet exist; GREEN built deterministic HTML, rejected a broken link, and validated advisory behavior (missing declaration, valid declaration, updated chapter, unrelated path). Ran the same suite after formatting the chapter sources.
- L5 — Local Chrome verified map → F1 → F4 → map, mobile deep-link at 390 px, and keyboard navigation. The first browser harness targeted an SVG element via an HTML-only click method; it was corrected and the recheck passed. This verified the atlas, not the clinical system.
- L6 — Independent verifier observed both specs met, confirmed a synthetic Git triple-dot diff with a realistic event and nonzero only for structural build failures. Parent reran the advisory against the verifier's fixture and observed both warnings with exit 0. The hosted workflow was not run as nothing was published. Verifier scratch cleanup was denied by the terminal policy.
- L7 — The implementation exceeds the advisory 400 lines by 33, mostly readable imported SVG lines; the generator, two pilot chapters, tests, workflow and guide form one coherent change and stay together.
