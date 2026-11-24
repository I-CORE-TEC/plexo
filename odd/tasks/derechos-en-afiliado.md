# Derechos dentro de cada afiliado
Estado actual (24/11/2026): integrado mediante PR227; recorrido conjunto real y cierre técnico verificados sin exigir aceptación humana, por instrucción expresa. Evidencia vigente y límites: [cierre técnico](derechos-novedades-cierre.md). El estado original y la bitácora siguientes son históricos; no acreditan despliegue ni aprobación normativa OSTEL.

Objetivo: integrar el circuito existente en la ficha, sin cambiar política ni backend. Base: ebb73c94; rama juanikitro/DERECHOS-06-prueba-manual.
Estrategia: feature-branch-chain (continuidad local, sin publicación). Runners: Node test y Playwright aislado. Estimación: 250–400 líneas propias.

## Specs
- S1 — «quiero que despliegues una sesion con un agente dedicado a mover el modulo de derechos para sacarlo del sidebar y colocarlo de manera practica y util dentro de cada afiliado». Pestaña Derechos en ficha, identidad fija, sin segunda búsqueda ni pantalla duplicada.
- S2 — "Preserve the existing novelty workflow, evidence, history links, role permissions, tenant separation and legacy deep links." Reusar componentes y permisos; conservar rutas antiguas. No backend ni nuevas reglas.
- S3 — "Do not stop, restart or close those terminals, container, or other agents." Preservar 8231/5179 y casos manuales; pruebas aisladas. Extender guía simplificada sin revertirla. Demostración visible y aceptación humana separadas.

## Tasks
- T1 | S1-S3 | inline, unidad dependiente única, mapa delegado completado | IMPLEMENTADO: RED→GREEN, integración y tests; guía extendida sin incluir cambios previos en commit | sin commit
- T2 | S1-S3 | delegated verifier, Risk items 2/3 (identidad/permisos y navegación compartida) | VERIFICADO sin blockers; real E2E y aceptación humana pendientes | sin commit

## Log
### L1 — 2026-11-13
«quiero que despliegues una sesion con un agente dedicado a mover el modulo de derechos para sacarlo del sidebar y colocarlo de manera practica y util dentro de cada afiliado».
Handoff autoriza implementación local y pruebas, no publicación ni dependencias. Sesión nueva; autoridad previa no reutilizada. HEAD y rama coinciden; guía modificada por el usuario y .atl preservados. Archivo previo y espejo #3084 reconciliados: U1-U3 completos, aceptación humana pendiente, T5 excluido.
### L2 — Diseño
Pestaña Derechos junto a Datos, componente existente embebido con persona fija. Novedades global continúa disponible. Rutas antiguas conservan autorización de miembros aunque no aparezcan en menú. Identidad confirmada antes de montar acciones; registrar fija la persona; salir de pestaña limpia contexto de novedad/paginación.
Intent: operador/auditor revisa evidencia de una persona sin perder identidad. Se conservan tokens accent/texto/superficie/borde, tipografía y espaciado del portal; bordes suaves y pestañas existentes, sin nueva estética. Dominios: afiliación, padrón, evidencia, conciliación, historial, cobertura administrativa. No confundir habilitación con prestación garantizada.
Limitación: Vite manual observa el checkout y puede recibir HMR al editar; no se reinicia ni consume sus casos. Pruebas UI interceptadas no acreditan backend real.

### L3 — Implementación y checks propios
RED observado: menú aún incluía Derechos; dos recorridos UI no encontraban la pestaña. Se corrigió primero el mock que interceptaba módulos /src/api/; el enlace legado pasó en base. GREEN: 15 tests Node y seis recorridos UI desktop/mobile pasan. Reutilización de Derechos/Novedades; identidad fija desde ruta, registro bloqueado a persona, invalidación de resumen tras decidir, limpieza al cambiar pestaña. Sin backend ni dependencias. Verificador independiente en curso. Real E2E no ejecutado: configuración original usa puertos/casos manuales protegidos.

### L4 — Verificación y demostración
Verificador independiente: Node/build/probes y diferencial contra ebb73c94 PASS; roles y navegación previa conservados salvo remoción solicitada. Detectó carrera de sincronización en test auditor, corregida esperando consulta inicial (no cambio productivo). Probes relevantes incorporados al spec; 14 recorridos UI desktop/mobile PASS. Spot check Node del padre PASS. Demo Chromium visible en5194, datos/API totalmente simulados, captura inspeccionada; proceso propio36585, carpeta TEMP derechos-demo-qj01r9c4, vive mientras siga abierto ese navegador. No constituye backend real ni aceptación. Guía previa sigue sin commit para preservar su unidad pendiente. Backend real E2E actualizado pero NO ejecutado; suite global no repetida. Risk: items 2/3 (identidad y navegación compartida).
