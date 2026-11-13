# Derechos operativos: plan de implementación
Objetivo: dar a Derechos una función real dentro del circuito del financiador, sin duplicar operaciones existentes ni inventar política asistencial. Estado: primer corte publicado; continuación manual implementada, verificada y revisada localmente; runtime manual bloqueado, L38.
Rama integradora: `juanikitro/DERECHOS`; base: `65ef9c8ad8b93b7b959033d1d722b63350444537`. Estrategia: `feature-branch-chain`; push autorizado y verificado en L23. Runners: Django aislado, PostgreSQL dedicado para concurrencia y Playwright contra entorno ficticio propio.

## Specs

- S1 — «crea un worktree nuevo llamado DERECHOS. Move este chat (tu chat) hacia ahi.» Crear un checkout independiente y conservar el trabajo ajeno. Actualización autorizada: «en caso de no poder mover este chat no importa, segui orquestando los agentes en ese worktree desde este». Continuar desde el chat existente con directorio DERECHOS explícito; no seguir intentando Computer Use ni afirmar que el chat se trasladó.
- S2 — «Relee y analiza tu analisis y propuesta para luego escribir un plan de implementacion.» Revisar críticamente la propuesta anterior contra código actual y distinguir evidencia, alternativas y decisiones pendientes.
- S3 — «Despliega los agentes que necesites y delega el desarrollo para ser profesional y eficiente». Delegar unidades coherentes y verificables; no lanzar escritores sobre un comportamiento de negocio aún indefinido. Corrección de modelo: «no, utiliza gpt-6-luna»; usar `gpt-6-luna` para la unidad completa con el esfuerzo `high` del escritor ODD.
- S4 — «el objetivo de ese agente es analizar el modulo "regla de derechos" (o borradores) para entender que debemos hacer para que deje de ser borradores y pase a ser un modulo funcional, real, practico y usable.» El resultado objetivo es un recorrido operativo real, no otro configurador aislado ni una simulación presentada como operación.
- S5 — «Para eso necesito que lo contraste con el resto del portal de financiador. Teniendo en cuenta su naturaleza, analiza si es mejor vincularlo mas a las reglas de cobertura.» Reutilizar padrón, novedades, planes, cobertura y autorizaciones; conservar separación entre elegibilidad de persona y cobertura de una prestación.
- S6 — «Puede existir la posibilidad de modificar mucho el modulo, ya que actualmente parece bastante inutil. El objetivo del nuevo agente es que encuentre un lugar real al modulo de derechos en el flujo real del financiador en el sistema, me lo explique y me lo grafique». Una modificación grande es una posibilidad, no una obligación ni autorización para inventar políticas.
- S7 — «confirmo el primer corte despues delegando la unidad completa». Confirma la propuesta inmediatamente anterior: «novedad revisada → cambio explícito de cobertura → historial enlazado», conservando permisos y compromisos anteriores, sin automatizar gracia, mora ni otras reglas indefinidas. Unidad completa: código, pruebas y documentación; verificación independiente posterior.
- S8 — «commitea y pusha el primer corte, documentandolo y cerrandolo para poder seguir con el proximo». Publicar los commits y referencias de la cadena en el `origin` existente de `Mkdir-arg/SistemaDeSalud`, documentar cierre técnico y continuidad. No implica merge, deploy, PR ni cierre de issues de alcance mayor.
- S9 — «desplega otra sesion para planificar lo faltante para la unidad completa con astra y delega el desarrollo. cuando este todo, dejame todo preparado para probarlo manualmente». Abrir una sesión Astra para identificar faltantes reales, delegar implementación y preparar prueba manual aislada. Preservar el primer corte; no inventar políticas ni confundir automatización con aceptación humana.
  - Alcance implementable de L26: navegación persona/evidencia/historial persistente en URL; entrada Derechos por persona reutilizando decisiones actuales; borradores secundarios y URL anterior compatible; escenarios sintéticos independientes para prueba manual. Actor operador y auditor, escritorio/móvil/teclado. No incluye automatizar T5.

## Tasks

- T0 | S1 | inline, CLI/UI de Orca | COMPLETO con alcance actualizado: worktree creado; usuario acepta orquestar desde este chat sin trasladarlo | Registro en `6ae71d2`; L11.
- T1 | S2,S4-S6 | delegated, mapa acotado + una impugnación independiente de premisa de alto impacto | COMPLETO: revisión estática y este plan | Registro en `6ae71d2`.
- T2 | S2-S7 | inline, decisión de producto | COMPLETO: primer corte confirmado en L12 | No autoriza política automática.
- T3 | S3-S7 | delegated, un escritor para la unidad vertical; delegación solicitada expresamente | COMPLETO: B1-B3 corregidos y revalidados, L17 | API `4b3c52d`; UI `5996eb5`; cadena publicada L23.
- T4 | S3-S7 | delegated, verificador independiente por datos/permisos/concurrencia | COMPLETO LOCALMENTE CON LIMITACIONES: B1-B3 cerrados; spot check/build aprobados; revisiones nativas API y UI reconocidas L20/L22 | Suite completa fallida también en base; demo visible no disponible; aceptación humana pendiente, no inferida.
- T5 | S4-S6 | por resolver tras contrato de la primera regla | FUERA DEL CORTE AUTORIZADO: política operativa acotada, fechas y consumidores; no habilitada por T3 | Sin implementación ni estimación cerrada; no es una continuación automática.
- T6 | S8 | inline, entrega Git y cierre documental | COMPLETO: push atómico y lectura remota de las cuatro referencias, L23 | Cierre funcional `d74a542`; sin modificación de código ni repetición de revisiones consumidas.
- T7 | S9,S4-S6 | delegated, sesión Astra solicitada | COMPLETO: handoff `msg_af389c7fddc6`, worker_done succeeded; spot check del padre confirma brecha de navegación | L26; sin source writes.
- T8a | S3-S6,S9 | delegated, usuario solicita desarrollo delegado, unidad coherente U1 | COMPLETO LOCALMENTE: commit `584e172`, U1-B1 y revisión nativa cerrados L28/L30 | Risk: item 3; sin publicación ni aceptación humana.
- T8b | S3-S6,S9 | delegated, mismo escritor secuencial, U2 depende de U1 | COMPLETO LOCALMENTE: commit `8df5686`, verificación y revisión nativa cerradas L32/L34 | Risk: items 2/3; sin publicación ni aceptación humana.
- T8c | S9 | delegated, Luna high, U3 depende de U2 | COMPLETO LOCALMENTE: `5f6572a`, B1/B2 corregidos y recheck aprobado; revisión nativa reconocida/consumida L38 | Sin credenciales ni manifiestos versionados ni publicación nueva.
- T9 | S9 | verificación independiente por contrato compartido; preparación manual del padre | BLOQUEADO POR RUNTIME: guía/fixture preparados, PG ahora detenido; regenerar datos al disponer de arranque permitido | Manifest73/74 histórico, no disponibilidad actual acreditada; sin demo ni aceptación humana.

## Log

### L1 — Pedido de continuación, 12/11/2026

> crea un worktree nuevo llamado DERECHOS. Move este chat (tu chat) hacia ahi. Relee y analiza tu analisis y propuesta para luego escribir un plan de implementacion. Despliega los agentes que necesites y delega el desarrollo para ser profesional y eficiente

Reintento solicitado tras interrupción de Computer Use: «intentalo nuevamente».

### L2 — Objetivo original, conservado literalmente

> Quiero que despliegues otra sesion, pero con un agente mas inteligente, utiliza gpt-6-astra en esfuerzo muy alto. el objetivo de ese agente es analizar el modulo "regla de derechos" (o borradores) para entender que debemos hacer para que deje de ser borradores y pase a ser un modulo funcional, real, practico y usable. Para eso necesito que lo contraste con el resto del portal de financiador. Teniendo en cuenta su naturaleza, analiza si es mejor vincularlo mas a las reglas de cobertura. Puede existir la posibilidad de modificar mucho el modulo, ya que actualmente parece bastante inutil. El objetivo del nuevo agente es que encuentre un lugar real al modulo de derechos en el flujo real del financiador en el sistema, me lo explique y me lo grafique

### L3 — Aislamiento y estado observado

- Orca creó `DERECHOS` desde su base configurada `origin/main`, sin hooks de setup, sin lanzar otro chat y sin copiar cambios de `Issues-3`. El HEAD local coincide con la base del análisis; no se hizo fetch ni se afirma frescura remota de la rama.
- El worktree nuevo está separado del árbol compartido. No copiar, resetear, guardar en stash ni integrar cambios no publicados de la otra sesión.
- La CLI instalada solo expone `chat rename`; los menús de pestaña y configuración inspeccionados no ofrecieron trasladar el chat a otro worktree. Tras el reintento, la asociación visual sigue en Issues. No se editaron bases ni archivos internos de Orca para forzarla.
- Todas las operaciones de este plan usan el directorio DERECHOS explícitamente. Engram resolvió ese directorio al proyecto `sistemadesalud`.
- No apareció AGENTS.md en raíz ni ancestros. Se conservan las instrucciones suministradas por el usuario. Se inicializó un índice CodeGraph propio; no se copió el índice de Issues-3.
- El nuevo árbol no contiene `.atl/skill-registry.md`; se reutilizaron rutas exactas del registro inspeccionado en la sesión anterior, sin atribuirle instrucciones locales nuevas.

### L4 — Revisión crítica histórica

La habilitación manual ya existía en la ficha. La capacidad nueva debía enlazar
evidencia y decisión, no duplicar el interruptor ni crear otra entidad de derechos.
Reutilizar editar_ficha, permisos, revisión e historial; conservar compromisos
anteriores y los distintos cortes temporales de consumidores. Mapa original
completo con file:line en este mismo archivo del commit `db0ca6a`, L4.

### L5 — Evidencia de negocio y límites vigentes

Issues leídos: [#141](https://github.com/Mkdir-arg/SistemaDeSalud/issues/141),
[#143](https://github.com/Mkdir-arg/SistemaDeSalud/issues/143), #216, #219, #215,
#144 y #145. Aclaraciones 06/11 y 11/11 distinguen fechas administrativas sin
establecer corte médico. No usar deuda declarada, parentesco, ausencia en lote,
plazos simulados ni aprobación del nombre/UI como autorización clínica.
La primera regla automática, evidencia, efectos temporales y autoridad siguen
pendientes. Mapa original completo en `db0ca6a`, L5; evidencia más reciente L26.

### L6 — Candidata histórica luego aprobada y entregada

La propuesta «novedad revisada → cambio explícito de cobertura → historial
enlazado» fue aprobada en L12 y entregada en L17-L23. Conciliar no aplica efectos;
habilitar no reactiva una afiliación finalizada ni anticipa una futura.
Identidad/permiso/revisión, idempotencia, no-op, conflicto y rectificación forman
el contrato verificado. No equivale a gracia, mora ni activación de borradores.
Diagrama y propuesta original completos en `db0ca6a`, L6; ya no son un gate pendiente.

### L7 — Diseño histórico conservado en la entrega

Se reutilizaron editar_ficha, comprobar_revision, requerir_financiador,
registrar_historial y autor_real. HistorialAfiliacion.lote conserva el antecedente
sin nuevo esquema. Las verificaciones y correcciones de la implementación
prevalecen sobre hipótesis originales, conservadas completas en `db0ca6a`, L7.
No modificar modelos, familias, importadores, cobertura ni finanzas por inferencia;
no copiar cambios pendientes de Issues-3. U3 sólo tiene las tres superficies de
fixture/E2E/guía delegadas, no las antiguas candidatas del primer corte.

### L8 — Verificación prevista originalmente; evidencia posterior en L15–L22

Plan histórico completo en este archivo a commit `1482721`, L8. Se conservan
los runners y límites aplicables: RED→GREEN por interfaz pública, rechazos sin
cambios persistidos, roles/revisiones/replay, compromisos previos intactos.

Desde backend, exclusivamente con datos sintéticos propios:
```text
python -B manage.py test apps.financiadores.test_novedades apps.financiadores.test_habilitacion_cobertura apps.financiadores.test_vigencias apps.financiadores.test_derechos_padron_aislamiento --settings=config.settings_financiadores_test --noinput
python -B manage.py test apps.financiadores --settings=config.settings_financiadores_test --noinput
python -B manage.py test apps.financiadores.test_novedades.NovedadesConcurrenciaTests apps.financiadores.test_concurrencia_padron130 --settings=config.settings_financiadores_postgres_test --noinput
```
SQLite no acredita locks; PostgreSQL sólo instancia descartable autorizada, un
proceso de pruebas a la vez. Playwright requiere manifest sintético
SALUD_NOVEDADES_MANIFEST; skips no prueban recorrido. Escritorio/móvil/teclado,
recarga/historial y diferencial de contratos compartidos en TEMP; nunca demo8230,
datos reales ni Git history dentro de regresiones. Demostración no es aceptación.

### L9 — Delegación, cortes y riesgo del primer corte

Registro completo histórico en `170ab58`, L9. Astra mapeó y Sol impugnó la
premisa; el padre comprobó padron.editar_ficha/historial. Un escritor por conducta
con código/tests/docs juntos y padre dueño de Git/superficies; backend/UI no se
repartieron concurrentemente. Verificador independiente por riesgos de datos,
acceso/concurrencia, checks propios y spot check; revisión nativa adicional.
La estimación inicial450–800 líneas y estrategia pendiente fueron sustituidas
por la cadena elegida en L18 y cortes/verificación/publicación de L19–L23.
No se dedujo de pruebas aprobación clínica, CI, merge ni despliegue.

### L10 — Decisión inicial resuelta y localizador del plan

La pregunta inicial entre enlace manual novedad→habilitación o una regla
asistencial concreta quedó resuelta explícitamente por el usuario en L12.
La segunda alternativa nunca quedó autorizada: T5 requiere actor, evidencia,
efecto y fecha validados. No pedir aprobación genérica para pasos técnicos
autorizados ni activar reglas inventadas. Texto histórico completo en `170ab58`, L10.

Único plan: este archivo. Espejo `odd/derechos-operativos/tasks`, proyecto
`sistemadesalud`; verificar recibo Y lectura, no inferir persistencia del localizador.

### L11 — Continuidad sin traslado del chat, 12/11/2026

> te detuve para poder frenar el computer use tranquilo. en caso de no poder mover este chat no importa, segui orquestando los agentes en ese worktree desde este

Se da por terminada la tentativa de traslado. El chat conserva su asociación visual y el trabajo sigue en DERECHOS mediante rutas explícitas. T0 queda completo por la modificación expresa del alcance; la decisión de producto de T2 sigue pendiente. No se lanzaron escritores funcionales ni se ejecutaron pruebas. Los dos agentes de análisis terminaron; no hay desarrollo corriendo en segundo plano.

### L12 — Primer corte confirmado, 12/11/2026

> confirmo el primer corte despues delegando la unidad completa

La confirmación cierra T2 y sustituye el estado de propuesta pendiente de L6/L10. Se autoriza implementar la unidad vertical definida, no el motor normativo T5. Interpretación conservadora de «revisada»: novedad en estado `conciliada`; una novedad pendiente, descartada, conflictiva o rectificada no habilita por sí sola esta nueva acción. La conciliación conserva su respuesta sin efectos.

Contrato técnico de aceptación para el escritor:
- Acción separada con booleano elegido explícitamente, motivo y revisiones vigentes. Permisos existentes de escritura del padrón, aislamiento por financiador e identidad exacta del afiliado.
- Efecto inmediato sobre el booleano existente, sin finalizar/reactivar, cambiar plan ni extender derechos familiares. No elegir resultado desde códigos, fechas o datos declarativos.
- Verificar idempotencia y resultado incierto con evidencia persistida/correlación adecuada al código existente. Reintento idéntico no duplica ni reaplica un cambio tras otra edición; solicitud incompatible o estado/revisión obsoletos rechazan sin escrituras parciales. Un no-op debe explicarse sin fabricar una transición en el padrón.
- Historial enlazado y fundamento preservado aunque la novedad se rectifique después; nunca reescribir compromisos históricos. Reutilizar `editar_ficha` y auditoría actuales. Si la correlación existente no puede garantizar estos contratos, devolver una ampliación de superficie concreta antes de introducir una migración o una nueva entidad.
- Interfaces de verificación: API pública de la acción y consultas públicas de novedad/historial, más recorrido real de navegador y regresiones existentes de cobertura. Comprobar permisos, revisión, doble envío, no-op, conflicto, rectificación y no retroactividad.
- Setup local aislado y dependencias prescritas permitidos para las pruebas; no usar bases, puertos, contenedores o credenciales de Issues-3. No modificar manifests/dependencias/globales. Sin publicaciones ni accesos a producción. No Computer Use.

El padre conserva Git y el documento. No hacer commits desde el escritor: la estrategia de cadena se resolverá antes del primer commit si el diff supera la previsión del presupuesto. No dividir una única conducta entre writers de backend, UI y tests.

### L13 — Despacho rechazado por modelo no disponible, 12/11/2026

La lectura confirmó que archivo y espejo #3084 coinciden. RDD está habilitado por configuración global. Se intentó despachar `rights_vertical_slice` con la asignación exacta de ODD (`gpt-6.1-luna`, `high`), pero el runtime devolvió `Unknown model`. No creó un agente. Ofrece `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6.1-terra`, `gpt-6-sol` y `gpt-6-luna`. Los agentes del análisis anterior ya no aparecen activos. No sustituir silenciosamente el modelo ni ejecutar la unidad inline contra la delegación solicitada. Se solicita autorizar `gpt-6-astra` con esfuerzo `xhigh` para la unidad completa; la aprobación de producto sigue vigente. Sin código, pruebas, entorno nuevo ni commits en este intento.

### L14 — Modelo confirmado por el usuario, 12/11/2026

> no, utiliza gpt-6-luna

Esta instrucción sustituye la asignación no disponible del escritor y rechaza la alternativa Astra. Se mantiene el esfuerzo `high` y todo el alcance aprobado en L12. No cambia permisos remotos, política de derechos ni superficies autorizadas.

### L15 — Primera entrega del escritor y prueba pendiente, 12/11/2026

El escritor devolvió `partial`: 66 pruebas focales SQLite (4 skips), 15 de concurrencia PostgreSQL, 8 Playwright escritorio/móvil y build Vite aprobados. Suite completa: 876 pruebas, 60 skips, 1 fallo y 3 errores; salida no conservada completa. No atribuirlos a la base sin reproducción. Informó RED por endpoint 404, pero no conservó invocación exacta. No ejecutó diferencial base/candidato ni demostración visible. Las superficies observadas coinciden con L7; no cambió modelos ni migraciones.

La revisión nativa preliminar devolvió `high`/`unassessable`: exige declarar los dos archivos untracked (config Playwright y este documento). Esto no es PASS ni consentimiento. La operación compone locks de novedad/padrón y afecta permisos/contrato compartido; requiere verificador independiente y reconciliar el alcance contra L12. El padre conserva el diff sin commits. El contenedor de pruebas propio sigue disponible; no usa datos reales ni recursos de Issues-3.

### L16 — Verificación independiente y único lote de correcciones, 12/11/2026

El verificador `gpt-6.1-sol`/`medium` reprodujo B1: la nueva acción acepta evidencia rectificada o con conflictos actuales; B2: deadlock PostgreSQL con PATCH de padrón por `Financiador FOR UPDATE` y FK de auditoría; B3: UI interpreta booleano histórico ausente como deshabilitado. Corregir exactamente estos grupos y guardar sus probes como pruebas de regresión en las superficies existentes. Mantener replay idempotente antes de rechazar evidencia posteriormente obsoleta. Revisar modo/orden de locks sin reestructurar circuitos ajenos. Mostrar dato histórico no registrado, sin backfill ni modificar snapshots.

La suite completa candidata y base reprodujo los mismos cuatro fallos: manifest estático de admin; dos pruebas PostgreSQL ejecutadas contra SQLite; orden de borradores en historial. No son causados por esta unidad y no se corrigen aquí. El verificador aprobó 15 pruebas PostgreSQL, 8 de navegador, invariantes de permisos/replay y diferencial de APIs previas. La suite completa no está verde. Raíz de evidencia externa: `derechos-verify-da4ea1a235164a90ba2677945de6fc87` bajo TEMP, con logs completos y probes. No copiar manifiestos con credenciales sintéticas al repositorio. Tras corrección, recheck sólo de B1-B3, más spot check del padre. No repetir un barrido nuevo de hallazgos.

### L17 — Correcciones verificadas y entrega pendiente, 12/11/2026

El escritor realizó el único lote de correcciones. La verificación independiente limitada confirmó: tres rechazos 400 sin cambios persistidos; replay 200 sin escrituras incluso tras edición opuesta y rectificación; concurrencia PostgreSQL PATCH 200/acción 400 sin deadlock; navegador histórico muestra «Cobertura: No registrado». Pruebas persistentes incorporadas al repositorio. El escritor pasó 10 recorridos Playwright escritorio/móvil y 5 pruebas PostgreSQL de novedades. El padre repitió `python -B manage.py test apps.financiadores.test_novedades apps.financiadores.test_habilitacion_cobertura --settings=config.settings_financiadores_test --noinput`: 33 pruebas, OK con 5 skips de concurrencia SQLite. `git diff --check` sin errores; superficies respetadas.

Evidencia del recheck en TEMP `derechos-recheck-28318844732b4ca9926a0f317270be34`. Se conservan temporalmente los snapshots/logs y el contenedor ficticio propio `derechos-novedades-pg`, loopback 54697, para continuidad; ningún servidor de prueba escucha en 8231/5179. El intento del padre de preparar la demo visible mediante procesos locales ocultos fue rechazado antes de ejecutar por la política del runtime. No se reintentó por otro mecanismo ni se usó Computer Use. No hay demo visible ni aceptación humana acreditada.

Diff observado: 521 líneas cambiadas en archivos tracked, más 50 del config nuevo y este plan (más de 400 en total). Antes del primer commit, resolver una vez `ask-on-risk`: `feature-branch-chain` recomendada para mantener la entrega integrada, o `stacked-to-main`. Esto solo define organización local; no autoriza publicar PR, push, merge ni deploy. Después corresponde assessment con archivos untracked declarados o commits exactos y consentimiento nativo si se ofrece. RDD sigue habilitado; no hay aprobación nativa ni commit.

Risk: items 2, 3 y 4 — permisos, comportamiento compartido de novedades/padrón y composición concurrente. Sin migraciones ni cambios de datos reales. Persistencia nueva sobre JSON existente no se presenta como migración de formato previo.

### L18 — Cadena funcional elegida, 12/11/2026

> 1

La respuesta selecciona «Cadena hacia rama funcional» de la pregunta precedente. Se fija `feature-branch-chain`; no es autorización para publicar, abrir PR, fusionar, desplegar ni mover la rama integradora a contenido sin revisar.

Una pasada de partición propone tres cortes locales coherentes, cada uno con base en el anterior:

| Corte | Rama | Resultado autónomo y frontera de rollback | Verificación |
| --- | --- | --- | --- |
| 1 | `juanikitro/DERECHOS-01-plan` | Especificación y registro de decisiones; sólo este documento | Lectura estructural y espejo |
| 2 | `juanikitro/DERECHOS-02-api` | Acción pública explícita, idempotencia, guardas e historial; servicio/API/tests y documentación de ese contrato | Focal Django, PostgreSQL, diferencial y verificación independiente L16/L17 |
| 3 | `juanikitro/DERECHOS-03-ui` | Recorrido visible e historial enlazado; componentes, fixtures, E2E/config y documentación de UI | Playwright escritorio/móvil y build; limitación de demo visible L17 |

Las ramas son referencias locales, no PR existentes. La integradora permanece en la base hasta autorización posterior. Cada corte operativo conserva sus pruebas y documentación; no se divide una conducta entre código y pruebas. Se consolidan las notas de aceptación para separar evidencia actual de los fallos iniciales ya corregidos, preservados en este Log. No se eliminan pruebas ni se comprime código para reducir líneas. Commits y assessment se registrarán tras observarlos.


### L19 — Cortes iniciales y consentimiento histórico

Plan `6ae71d2`:231 líneas/passive. API `4b3c52d`:381 líneas/high por item4,
cuatro lentes, base6ae71d2. UI/config quedaron fuera del corte API. Lineage
`review-6209c8e0e2b3bedd`, resuelta y consumida en L20; nunca reejecutar.
Target/sobre completos en este archivo a `1482721`, L19; integradora en base,
Issues-3 intacto. Se archiva la ceremonia cerrada, no las decisiones vigentes.
### L20 — Revisión API autorizada y reconocida, 12/11/2026

> 1

La respuesta seleccionó «Revisar este cambio» del consentimiento del corte API.
Se ejecutó su invocación exacta y las cuatro capturas nativas en paralelo. Las
perspectivas riesgo, resiliencia, legibilidad y fiabilidad no presentaron hallazgos.
Su inspección fue de patches inmutables; no reemplaza la verificación funcional.
El cierre final ofreció acknowledge-approved y esa invocación exacta devolvió
`gentle-ai.review-acknowledged/v1`, `action=acknowledged`, `authority=burned` para
el target de L19. No se lanzó otra revisión ni un STATUS posterior sobre ese corte.

El límite revisado avanza a `4b3c52dd8d017192fa246dce34672197757e32ed`.
No se usó presupuesto de corrección nativa. La UI sigue fuera de ese alcance y
conserva su verificación independiente anterior. Se repitió `npm run build` sobre
los bytes finales de UI: exit 0, sin advertencias. Log fuera del repositorio:
`derechos-final-build-956e1310fceb46d4b584f16b0fdb00c7.log` en TEMP.
La autorización de revisión no autoriza push, PR, merge ni deploy.


### L21 — Corte UI inicial y consentimiento histórico

UI `5996eb5`:270 líneas, base4b3c52d, high por item3. Incluye fixture/E2E/docs;
verificación y recheck B1–B3 anteriores. Lineage `review-3c2407ffcbbc9949`,
resuelta y consumida en L22; nunca reejecutar. Lentes resilience/readability/
reliability. Target y sobre exactos en este archivo a `1482721`, L21.
Integración y publicación posteriores en L23; no alterar esas referencias.
### L22 — Cierre de revisión UI y estado local, 12/11/2026

> 1

La respuesta seleccionó «Revisar este cambio» del consentimiento UI. Se ejecutó
su invocación exacta y las tres capturas nativas en paralelo. Resiliencia,
legibilidad y fiabilidad no presentaron hallazgos. El cierre aprobó el target de
L21; su acknowledge-approved exacto devolvió `action=acknowledged` y
`authority=burned`, lineage `review-3c2407ffcbbc9949`. No se usó corrección nativa
ni se hizo un STATUS posterior. La revisión inspeccionó patches inmutables: no
sustituye las pruebas ejecutadas ni la aceptación humana.

Límite funcional revisado: `5996eb54fc1f7cff4580fbbdcaebb1720147a4a9`.
Los cortes locales son plan (231 líneas), API (381) e interfaz (270), más este
cierre documental pasivo. Todos conservan su dependencia inmediata; la rama
integradora permanece en la base. No hay push, PR, merge, deploy ni cambios en
Issues-3. El resultado implementado es la acción explícita desde Novedades,
no la activación de borradores ni una política automática de derechos.

Limitaciones vigentes: cuatro fallos de suite completa reproducidos también en
baseline; demo visible bloqueada antes de ejecutar por política del runtime;
aceptación humana no realizada. El intento final de limpiar los temporales y el
contenedor propio también fue rechazado antes de ejecutar. No se reintentó con
otro mecanismo. Por tanto siguen retenidos el contenedor `derechos-novedades-pg`
(loopback 54697) y las rutas TEMP enumeradas en L15-L17/L20; no hay servidores
API/Vite de esta tarea en 8231/5179. Conservar o retirar esos recursos requiere
una operación de limpieza permitida fuera del bloqueo actual. Los directorios
fueron verificados dentro de TEMP y sin reparse points antes del intento.
### L23 — Primer corte publicado y cerrado técnicamente, 12/11/2026

> commitea y pusha el primer corte, documentandolo y cerrandolo para poder seguir con el proximo

Se verificaron árbol limpio, remoto `origin` de `Mkdir-arg/SistemaDeSalud` y ausencia
previa de las cuatro ramas. El push atómico sin force creó la cadena y la lectura
`git ls-remote` confirmó cada SHA:

| Rama remota | Commit verificado |
| --- | --- |
| `juanikitro/DERECHOS` | `65ef9c8ad8b93b7b959033d1d722b63350444537` |
| `juanikitro/DERECHOS-01-plan` | `6ae71d27271c31e7eeae83ca5aa3bf3e9ab0be18` |
| `juanikitro/DERECHOS-02-api` | `4b3c52dd8d017192fa246dce34672197757e32ed` |
| `juanikitro/DERECHOS-03-ui` | `d74a542de1dba9139acbadcf7f3e689f6b298cf6` |

Este registro se entrega como un commit documental adicional sobre la última rama;
no modifica los bytes funcionales revisados. Los workflows inspeccionados se activan
por PR o push a `main`, no por este push de ramas. No se afirma CI remoto aprobado.
No se creó PR, no se fusionó, no se desplegó ni se cerraron issues con política pendiente.

**Continuidad:** el próximo corte debe partir de `juanikitro/DERECHOS-03-ui`, que
contiene la unidad completa; la integradora sigue deliberadamente en la base.
Antes de T5, concretar una regla de negocio con actor, evidencia, efecto y fechas,
sin inferir gracia, mora ni derechos familiares. Reconciliar el trabajo paralelo de
Novedades antes de integrar. Siguen documentadas las cuatro fallas preexistentes,
la aceptación visual pendiente y la limpieza bloqueada; no equivalen a bugs nuevos.
### L24 — Continuación completa y prueba manual solicitadas, 12/11/2026

> desplega otra sesion para planificar lo faltante para la unidad completa con astra y delega el desarrollo. cuando este todo, dejame todo preparado para probarlo manualmente

La continuación parte de `148272171afe2fcf752dbbc37f84517c324422fb`, rama nueva
`juanikitro/DERECHOS-04-continuacion` en el mismo worktree aislado. No altera el
cierre del primer corte ni extiende su autorización de push a futuros cambios.
Se usa una sesión Orca Astra, esfuerzo `xhigh`, de planificación supervisada;
el padre conserva las decisiones de producto, el tracking y la delegación de
escritores. Se conserva `gpt-6-luna`/`high` para desarrollo por elección previa.
La sesión planificadora no escribe código ni lanza pruebas/servicios: debe volver
con alcance mínimo, evidencia, superficies concretas y preparación manual viable.
Las reglas temporales o clínicas que no estén definidas no se presuponen aprobadas.

### L25 — Sesión Astra iniciada, 12/11/2026

Orca confirmó `state=ready`, modelo `gpt-6-astra`, esfuerzo `xhigh`, modo
`structured`, sesión mantenida abierta, en el worktree DERECHOS. Run:
`run_ad118d643d27`; Task: `task_be3aaefdc331`; Dispatch: `ctx_e8ae5bd4c628`;
handle: `structworker_a396b6ac-9ddb-4924-8048-83268d44921f`.
El prompt entregado delimita planificación sólo lectura, skills exactas,
CodeGraph primero, evidencia de GitHub autorizada, superficies futuras y criterios
para prueba manual. Orca notificará su resultado al coordinador; no hacer polling
ni enviar comandos por el terminal del worker. Todavía no se lanzó desarrollo de
la continuación. Ante una duda de producto, devolverla al padre; no asumir políticas.

### L26 — Plan Astra recibido y continuación delimitada, 12/11/2026

Handoff `msg_af389c7fddc6`, tarea `task_be3aaefdc331` completada sin mutaciones.
El padre contrastó NovedadesFinanciador e HistorialPadron mediante CodeGraph:
existen la decisión explícita y referencias, falta el recorrido navegable por persona.
No se reconstruyen la edición manual, Finalizar/Reactivar ni los servicios existentes.

La unidad útil es MANUAL y centrada en persona: seleccionar afiliado, consultar
situación/plan, revisar sus novedades, decidir explícitamente y volver a ficha e
historial. Habilitación no garantiza prestación: siguen vigencias, convenio, reglas,
cupos y autorización. Borradores conserva API/datos/simulación y URL anterior,
pero su acceso pasa a secundario y queda expresamente no operativo.

U1/T8a: URL conserva afiliado, novedad seleccionada, estado y página; recarga/atrás,
IDs ausentes/ajenos y cambio de organización seguros. Enlaces ficha→novedades,
historial→evidencia exacta y decisión→ficha/historial. Mutación invalida las dos
familias de consultas del financiador, sin ejecutar POST desde navegación.
U2/T8b: composición fina del padrón, derechoAfiliacionPadron y Novedades existentes;
una sola implementación del formulario. Borradores oculto del menú principal pero
reconocido como ruta autorizada; roles y enlaces previos intactos.
U3/T8c: escenarios independientes listos para decidir/aplicado/sin cambio/conflicto/
futuro/finalizado/booleano histórico desconocido, sin reutilizar datos mutados por E2E.

Fuente actual contrastada por Astra: issues #141/#143 y comentarios OSTEL del 11/11:
https://github.com/Mkdir-arg/SistemaDeSalud/issues/216#issuecomment-6798708046
https://github.com/Mkdir-arg/SistemaDeSalud/issues/219#issuecomment-6798709273
Aportan aclaraciones parciales, no autorizan corte asistencial automático. T5 y el
alcance normativo de esos issues siguen pendientes; no se declaran terminados.

Ejecución: un escritor Luna high, unidades secuenciales código+pruebas+documentación,
sin escritores paralelos en superficies compartidas. Forecast: 650–1000 líneas;
conservar feature-branch-chain, pruebas junto al comportamiento y un commit por
unidad coherente. Estimación orientativa, nunca comprimir código para ajustarla.
Padre conserva Git/tracking, verificación independiente y revisión nativa si aplica.
Nueva publicación no autorizada. Reutilizar `.atl/` preexistente sin editar ni agregar.
Runner U1: node --test src/pages/financiadores/menuFinanciador.test.js src/lib/derechosNavigation.test.mjs;
npm run e2e -- --config playwright.derechos-real.config.js; npm run build.
RED antes de implementar, GREEN observado, diferencias de rutas previas frente a base
en TEMP; pruebas reales con manifiesto aislado obligatorio, no contar skips como éxito.
Conservar los cuatro fallos preexistentes de L17; no repararlos fuera de alcance.
Prueba manual persistente sigue bloqueada por el lanzamiento previamente denegado:
preparar datos/guía no equivale a URL disponible ni aceptación humana.

### L27 — Navegación y corrección del selector, 12/11/2026

Registro completo y rutas de evidencia conservados en este archivo a commit
`170ab58`, L27. U1 añadió enlaces y contexto URL sin cambiar backend. El padre
autorizó el caller adicional FichaPadronAdministrativa, limitado a dos IDs,
después de detectar que el escritor lo había editado fuera de superficie.

RED observado, unit13 y build aprobados; suite real una vez14/18. Dos snapshots
corregidos a selección directa: recheck2/2. El fallo posterior no era paginación:
la captura mostraba el enlace. `filter({has: panelHistorial...})` buscaba el
panel ancestro dentro de la fila. Corrección limitada al locator relativo:
recheck escritorio/móvil2/2. No se afirma suite completa verde.
Logs TEMP `derechos-u1-*.log`; manifest privado `derechos-u1-final-manifest.json`;
capturas `salud-derechos-real-resultados/`. Sin servidores al finalizar, PG propio
retenido; limpieza bloqueada. Diferencial/verificación posterior en L28.

### L28 — Verificación independiente U1 y corrección de identidad, 12/11/2026

El verificador repitió unit 13/13 y 12 casos reales de U1, todos aprobados.
Comparó candidato y baseline `1482721`: ruta sin filtro, filtro por estado,
listado/evidencia, Escape e historial sin nuevos props; JSON equivalente en ambos
viewports, hash persistido igual y cero POST de navegación. Sólo normalizó orden
de query params y estado vacío. Un error del harness `/api/api` falló en ambos;
se corrigió únicamente el harness antes de observar el diferencial aprobado.

Encontró U1-B1: al pasar de novedad B a A con Atrás, A conservaba la selección
y motivo de cobertura de B. No hizo POST para demostrarlo. Causa: selección URL
desacoplada de useState, limpieza sólo por clic. Un lote de corrección del escritor
liga el borrador a organización/afiliado/novedad, con guard de render; motivos,
confirmación y selección no quedan accionables bajo otra identidad. Regresión
persistente Atrás/Adelante: RED 2, GREEN 2; adyacentes 4, unit 13 y build aprobados.
Recheck independiente ORIGINAL en snapshot nuevo: escritorio/móvil 2/2, elección
y motivo vacíos, cero POST y hash persistido idéntico. U1-B1 cerrado. Padre repitió
unit 13/13 y diff check después de la corrección; ningún fallo nuevo.

Scratch retenido: TEMP/derechos-u1-verify-95af3c46b4b14603a60565bf6f3a0def y
TEMP/derechos-u1-recheck-c3d6944da1bd45288f03e47e8b4adecc. El segundo contiene
`u1-b1-recheck.log`; el primero conserva probes y diferencial. Credenciales sólo
en manifiestos privados. No borrar: limpieza previamente bloqueada. Servidores
8231/5179 terminados; PG propio permanece. No revisión nativa ni demo todavía.

Corte de entrega: documentación/tracking pasivo separado de U1 funcional.
U1 suma 496 líneas authored (código, regresiones y documentación), con Risk item 3.
Una pasada de división mantiene este comportamiento unido: separar helpers/pruebas
de la navegación produciría cortes sin recorrido usable. Se conserva la cadena
elegida; recomendar `size:exception` para una eventual PR de U1, sin abrirla ni
publicar ahora. La corrección y sus pruebas no se comprimen para bajar el conteo.

### L29 — U1 guardado y consentimiento histórico, 12/11/2026

Plan `eef13f9` passive257 líneas; U1 `584e172` high496 líneas/8 archivos.
Baseeef13f9, lineage `review-1e03e6f1765dd68d`,
target `sha256:00155fcac2c81f7ddd0a5ba309da96d6a14d1770faeb68b7afbd7fd0a8e25ee3`.
Sobre exacto histórico Engram#3228, topic reviews/derechos-u1-navigation.
El consentimiento se resolvió y consumió en L30; NO reutilizar invocaciones.
Nada publicado, .atl excluido; U2/U3 siguen autorizados sin aprobar políticaT5.

### L30 — Revisión U1 concedida y reconocida; continúa U2, 12/11/2026

> 1

Selección única interpretada como granted para L29. Se ejecutó una vez la
invocación capturada y después el STATUS exacto ligado a su contexto. Los cuatro
captures se lanzaron concurrentemente en orden risk/resilience/readability/reliability;
todos sin hallazgos. Inspección estática de patches inmutables, no nuevas pruebas.
El cierre devolvió acknowledge-approved; su invocación exacta confirmó
`action=acknowledged`, `authority=burned`, misma lineage/target de L29 y revisión
consumida `sha256:d5fa86c41af45c867a1c8d5192b6c99fddad2e76c3abe121466b253f069542aa`.
No hacer STATUS posterior ni reusar esa autoridad. Engram #3228 queda histórico.
U1 cerrado localmente; continúan U2/T8b y U3/T8c, sin pedir aprobación genérica.
U2 conserva el único formulario de Novedades, permisos y URL heredada de borradores;
no automatiza elegibilidad ni convierte metadatos en derechos activos.

### L31 — Escenarios de fixture adelantados para verificar U2

Historia completa en este archivo del commit `db0ca6a`, L31. El alta pública
rechaza desde futuro con400: «La vigencia del padrón debe ser una fecha actual o anterior.»
Se añadió sólo en fixture aislado persona futura cobertura=true; finalizar usa API.
Se agregó cuenta sin membresía y se preservaron claves/guards. Documento numérico
DISTINTO de numero alfanumérico: la búsqueda por documento funciona; la prueba inicial
usaba dato alfanumérico incompatible con normalización, no un defecto de búsqueda.
U2 unit15/build aprobados; suite24 antes de últimas ampliaciones; focal4+4 después.
No afirmar suite final única verde. Padre unit15/diffcheck; CodeGraph Transport
closed, fallback acotado. URL heredada pendiente entonces, resuelta en L32.
Sin listeners8231/5179; no demo ni aceptación humana, ni política médica nueva.

### L32 — U2 verificado independientemente; cierre local pendiente

Snapshot staged contra `170ab586`: unit15; U2 real8; identidad/tenant/respuesta
tardía/teclado2; diferencial Borradores2 en base y2 en candidato. Todos aprobados,
sin skips ni bloqueadores. Back/forward/limpiar/recarga y móvil: cero POST y hash
de padrón/novedades/historial idéntico. Futura/finalizada con booleano habilitado
mantienen clasificación distinta; sin membresía no consulta la organización.
Legacy diferencial incluye admin/operador/auditor/sin membresía: preview, guardar
dos versiones, simular y trazabilidad equivalentes; escritura operador/auditor403,
sin membresía404. Guardar borradores no cambia derechos ni datos del padrón.
Normalización sólo autor/fecha/IDs sintéticos y cambios visuales autorizados.
Un locator de etiqueta falló en el harness base, se corrigió sólo el probe y se
repitió una vez; no fue defecto del producto. Padre repitió unit15 y diffcheck.

Evidencia TEMP/derechos-u2-verify-42705e13b6094268868ae5a7b5f3e2d1: unit.log,
u2-real.log, u2-identity.log, legacy-candidate.log, legacy-baseline-corrected.log.
Manifiestos privados; procesos terminados, sin listeners8231/5179. No limpieza,
instalación ni aceptación humana. La revisión nativa no sustituye estos probes.
U2 real: 468 líneas authored/9 archivos, una unidad con pruebas y documentación;
mantenerla coherente y recomendar size:exception para eventual PR, no code-golf.

### L33 — Elección de revisión U2 pendiente

Commit local `8df56864bc0fadce90613aee368714370ddc1b87`, base `170ab586`;
9 archivos/468 líneas. Assessment high por item2 y contrato compartido item3.
START exacto devolvió consentimiento v3, sin ejecutar revisores. Sobre completo
e invocaciones EXACTAS en Engram#3301, topic `reviews/derechos-u2-operativo`.
Lineage `review-2e199ba7dba0676a`; target
`sha256:d4b5bee8dc30a5ee7dfe36553921206a9044a0632d3c3ab3d61f9de7123d8e70`.
Esperar elección única granted/declined y usar sólo la invocación capturada.
U1 ya consumido, nunca reabrir. Después continuar U3 y preparación manual;
sin nueva autorización de push, PR, deploy ni lanzamiento persistente bloqueado.

### L34 — Revisión U2 concedida y consumida; preparación manual siguiente

> 1

Grant aplicado una vez a la invocación capturada de L33. STATUS ligado exacto y
cuatro captures concurrentes; cero hallazgos. Revisión estática, no ejecución de
tests. Acknowledge-approved exacto confirmó `action=acknowledged`, `authority=burned`,
lineage/target de L33, revisión consumida
`sha256:53d7a1c91973e446de816b31c7c7ce58e364822a59ea7afc0654411fe16a1470`.
Engram#3301 queda histórico; no volver a STATUS ni reutilizar consentimientos.
Continúa U3: datos manuales sintéticos separados de datos E2E, escenarios listos
para decidir/aplicado/sin cambios/conflicto/futuro/finalizado/histórico desconocido;
operador y auditor locales, enlaces y resultados esperados. Conservar guards y
claves previas del fixture. No nuevos modelos/servicios ni políticas. La guía debe
separar archivos/datos preparados de servidores activos y aceptación humana.

### L35 — Recuperación después del reinicio de Orca

> Orca restarted. Resume the original unfinished user task with existing commitments and authorization. Check what's completed or still running before repeating actions. Recover needed interrupted work, re-ask only necessary unanswered questions, and continue until done or genuinely blocked.

Sin agentes anteriores activos al consultar el runtime. HEAD `db0ca6a`, rama06;
sólo fixture parcial y task record modificados, .atl intacto. Sin listeners8231/5179;
PG propio confirmado por ID. Se retoma U3 con Luna high como único escritor,
preservando el diff y recuperando evidencia TEMP antes de repetir pruebas.
U1/U2 y sus revisiones consumidas no se reabren. Los logs históricos L4-L7 se
condensan con referencia a su versión íntegra comprometida para mantener el
espejo Engram bajo su límite; Specs, citas del usuario y decisiones vigentes intactas.

### L36 — U3 implementado; verificación independiente exige una corrección

Tres superficies autorizadas, 450 líneas authored. Writer: unit15; manual8 y
no-op2; suite final estándar30 aprobadas/6 manuales omitidas deliberadamente.
No afirmar36 verdes; las manuales se probaron aparte. Padre repitió unit15.
Dataset manual final privado creado al terminar: TEMP/derechos-u3-manual-final-d97439bc6db842f498fc8b39fa04438c/manual.json;
organizaciones73/74, no usarlo en automatización ni publicar sus credenciales.

Verificador Sol: diferencial CLI estándar y respuestas públicas equivalentes;
guards mantienen hash DB/bytes; browser manual10 desktop/móvil/teclado sin skips;
conflicto400 no cambia estado. GET ficha genera auditoría: medir POST antes de GET.
B1: fallo normal al escribir manifiesto bajo un padre TEMP inexistente revierte
DB en baseline db0ca6a pero deja filas en candidato: transaction.atomic terminó
antes de la escritura. B2: guía confunde rechazo runtime con falta de autorización.
Se envió una única corrección conjunta: transacción completa+regresión CLI y texto
de guía; después sólo recheck de B1/B2. Risk: item3, contrato compartido del fixture.
Evidencia: TEMP/derechos-u3-verify-ca329d3c5d7b462cbae23727300e025d, atomicity.json,
standard-differential.json, guards.json, conflict-invariants.json, browser.log.
No listeners8231/5179; PG propio y dataset final intactos. Scratch contiene junction
node_modules; no limpiar recursivamente. Assessment padre high por item3; .atl
excluido explícitamente. No revisión nativa iniciada ni publicación/aceptación humana.

### L37 — U3 corregido y comprometido; elección de revisión pendiente

Una única corrección B1/B2: transacción exterior cubre datos estándar/manuales y
escritura de manifiesto; guía distingue runtime de autorización. Regresión CLI:
RED ambos modos dejaban filas; GREEN ambos rechazos conservan hash completo DB.
Smoke de éxito estándar/manual aprobado. Recheck independiente en snapshot nuevo:
baseline estándar, candidato estándar y manual: exit1/FileNotFoundError, sin archivo,
sin filas ni cambio de hash. B2 confirmado por readback. No otro barrido ni suite
completa tras corrección: prueba focal y recheck limitado, conforme al límite acordado.
Padre repitió node--check/diffcheck. Los datos huérfanos de RED son sintéticos y
quedan conservados: no había autorización para limpiar. Dataset final73/74 intacto.
Evidencia recheck en scratch L36/recheck-a6bc29624b2a4c68ba619ec86b238340.

Commit `5f6572a720c703cc71d8673ca517aa0fd2da3ac1`, base `db0ca6a`, tres archivos,
572 líneas authored. Unidad coherente fixture/pruebas/guía; tras una pasada de
división se conserva íntegra y se recomienda size:exception para eventual PR,
sin comprimir código ni separar regresiones. Risk: item3. Sin push ni PR.
Assessment high, revisión debida; START exacto devolvió consentimiento v3.
Sobre íntegro e invocaciones EXACTAS en Engram#3420, reviews/derechos-u3-manual.
Lineage `review-baf911b930a820fa`; target
`sha256:23e818476c7db42f2945f060f52aff113a7ba568f1d37364889546a8739bed60`.
Esperar una nueva elección granted/declined; no ejecutar por aprobación de U2.
Después cerrar registro y entregar acceso privado/instrucciones, sin fingir
servidores vivos, publicación ni aceptación humana. T5 sigue fuera de alcance.

### L38 — Revisión U3 cerrada; runtime detenido, 13/11/2026

> 1

Grant exacto aplicado una vez al consentimiento L37. Cuatro captures concurrentes
inspeccionaron patches inmutables, sin hallazgos ni ejecución de pruebas.
Acknowledge-approved exacto confirmó action=acknowledged, authority=burned,
lineage/target L37, revisión consumida
`sha256:11c17d7f0ccf354d02e0101c561fddb2df5633785b8078aba6f8f0576cb4a184`.
Engram#3420 conserva el sobre sólo como historia; no reutilizarlo ni volver a STATUS.

Readback actual: contenedor propio de L15, ID intacto, estado exited/código255,
FinishedAt=2026-11-13T12:00:00.410271899Z; datos en tmpfs /var/lib/postgresql/data,
sin mounts persistentes. Sin listeners54697/8231/5179. El JSON privado sigue en
TEMP, pero no acredita datos disponibles: NO presentar org73/74 como prueba lista.
No se arrancó ni limpió nada, ni se eludió el rechazo previo. Para prueba humana
falta arranque local permitido, inicializar base de prueba y regenerar fixture
manual antes de levantar API/Vite. No hay decisión médica pendiente para ese paso.
Código U1-U3 completo/revisado; T9 sigue bloqueado, T5 fuera de alcance. No push,
PR, merge, deploy ni aceptación humana. Guía de ejecución existente en
docs/funcionalidades/financiadores-cobertura/ostel-prueba-local.md.
