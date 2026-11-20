# Aceptación conjunta: Derechos en la ficha y gestión de Novedades

## Ajuste del selector y del detalle (20/11)

El campo **Prestación y hospital** busca por nombre, código u hospital y permite
seleccionar una opción del catálogo. Buscar no ejecuta una simulación: se debe
seleccionar y luego pulsar **Simular**.

- Los resultados aparecen sobre el formulario, sin desplazar fecha, cantidad ni
  acciones. Carga y errores quedan dentro de esa capa; no se desmonta el formulario.
- Al seleccionar, queda sólo la etiqueta elegida. Escribir otra búsqueda elimina
  la selección anterior. Escape cierra primero los resultados y luego el modal.
- El detalle prioriza estado, decisión, conflictos y acciones. La evidencia queda
  después; **Historial de decisiones** comienza plegado y se abre con clic o Enter.
- Patrón reutilizable documentado en `docs/FUNDACION-FRONTEND.md`, sección
  **Selección con búsqueda**. No se modifican reglas, permisos ni efectos de negocio.

Prueba manual: abrir la consulta, buscar, seleccionar y volver a buscar; comprobar
que los demás campos no se mueven. Repetir con teclado y en móvil. Abrir una
novedad y desplegar su historial sin alterar la evidencia.

Estado de verificación: suite UI propia completa de 24 casos aprobada. La prueba
inicial reprodujo el desmontaje; el primer recheck detectó una medición durante
la animación y la suite intermedia encontró selectores de test ambiguos. Se
corrigieron las esperas y el alcance del test, sin relajar el umbral de geometría.
La integración previa pasó sus 14 casos. El verificador independiente completó
5 probes y dejó uno desktop incompleto por dos errores de su script de click
exterior, no por un fallo reproducido del producto. Se incorporó el probe con un
objetivo exterior correcto a la suite propia: pasó en escritorio y móvil. No se
probó lector de pantalla.

Docker sirve el bundle nuevo, con identidad de fuentes y assets comprobada. Se
verificó login → Derechos → consulta → detalle, con API real, teclado, historial
plegado y sin desbordamiento en escritorio/móvil. Catálogo y pagos de esos datos
automatizados están vacíos; la selección positiva se verificó con mocks. No se
repitió la suite E2E que requiere los puertos de aceptación ocupados ni se consumió
ningún caso humano. Se abrió una pestaña visible; requiere el login del usuario.

La publicación se prepara en un workspace aislado, con un único PR y excepción
de tamaño autorizada. La revisión API corrigió la combinación CSV/pagos; la
validación aceptó los hallazgos originales y señaló el rechazo de parámetros
inválidos como cambio de compatibilidad. El responsable aceptó ese cambio. Esto
no equivale a una aprobación nativa: su estado permanece escalado. La revisión
de Claude y la aceptación humana quedan pendientes.
Las cifras PostgreSQL de la sección siguiente corresponden al 19/11; no son una
nueva ejecución del backend para este ajuste visual.

## Consulta de prestaciones y pagos (19/11, disponible en Docker)

El cambio nuevo reúne la ayuda en el `(?)` de **Situación de afiliación** y usa una tabla de novedades como las otras pestañas. Los borradores siguen siendo preparación de reglas: el enlace no activa una política ni modifica afiliaciones.

**Consultar prestación y pago** ofrece dos consultas distintas, sin efectos de negocio:

- **Simular cobertura:** elegir prestación/hospital, fecha y cantidad. Comprueba afiliación, plan actual, convenio, reglas, cupo y arancel conocidos. Devuelve importes estimados y comprobaciones; si falta autorización o información, muestra evaluación pendiente. No reconstruye un plan histórico ni reserva cupos. La estimación no es una autorización ni un pago.
- **Pagos registrados:** consulta atenciones realizadas visibles para el financiador. Muestra cada cuenta por separado: cargo original, ajustes, obligación actual, pagos netos aprobados, deuda, devolución y operaciones pendientes de aprobación. Una cuenta sin deuda puede deberse a un ajuste; una atención sin cargo registrado no se presenta como pagada. El acceso histórico mantiene las restricciones existentes.

Ambas consultas quedan auditadas. No crean casos, reservas, cargos, movimientos de dinero ni cambios de derechos. Sin convenios o prestaciones configurados, el catálogo queda vacío: no se inventan reglas para hacer pasar una simulación.

### Contrato de consulta

Ver [Contrato de lectura de la API](consulta-prestaciones-api.md). Los saldos
están disponibles únicamente en JSON; `pagos=true&formato=csv` devuelve HTTP 400.
Los valores inválidos de `pagos` también devuelven HTTP 400, cambio de validación
aceptado expresamente por el responsable del proyecto el 20/11.

### Comprobación manual nueva

1. Abrir Derechos en una ficha. No debe aparecer el encabezado redundante; el enlace a borradores y las aclaraciones quedan en `(?)`.
2. Abrir **Consultar prestación y pago** con teclado. Simular una prestación configurada y distinguir cobertura, importes y verificaciones pendientes.
3. Cambiar a **Pagos registrados**. Contrastar pagos aprobados y deuda, sin confundir la resolución administrativa con un pago.
4. Cerrar antes de cambiar persona o pestaña. Al reabrir en otra ficha no debe trasladarse la consulta anterior.

Verificación de esta ampliación: última suite completa PostgreSQL 134 PASS, sin fallos ni skips; 18 pruebas UI propias y 14 de integración previa pasan en escritorio/móvil. Build repetido por el padre con bytes idénticos. Probes independientes de permisos, saldos, JSON/CSV legado, paginación y teclado sin defectos del producto reproducidos; el probe de liquidación completa del verificador no terminó por un guard correcto de su fixture, mientras la prueba PostgreSQL propia de cuenta totalmente pagada sí pasa. Un error inicial de fixture fue corregido antes de la última suite.

Docker actualizado sólo en el backend y bundle propios. Recorrido real autenticado con datos automatizados separados: ayuda/tabla, modal, catálogo vacío, pagos vacíos, detalle y teclado pasan en escritorio/móvil, sin errores API ni escrituras de negocio. Los escenarios humanos no se consumieron. El cálculo positivo y los saldos se comprobaron en tests aislados; no se afirma una simulación positiva en navegador Docker, porque los escenarios automatizados usados no tienen prestaciones configuradas. La apertura automática de un navegador visible no estuvo disponible; abrir la URL manualmente.

Pendientes: aceptación humana y cierre en commits/revisión nativa del candidato propio. Sin publicación. La evidencia histórica que sigue corresponde al candidato anterior.

## Estado y acceso
Evidencia de esta sesión: PostgreSQL47 PASS,0 FAIL,0 SKIP (también repetido por el agente principal). Última suite completa de navegador real:40 PASS,2 FAIL,0 SKIP. Después de corregir la sincronización del test, recheck acotado de esos dos casos:2 PASS,0 FAIL,0 SKIP. No hubo otra suite completa posterior; no se presenta como una única ejecución42 PASS. El otro agente revisó esta guía, no repitió estas pruebas reales. No equivale a aceptación humana.

Se preparó un dataset humano nuevo después de las pruebas: dos organizaciones independientes, siete escenarios cada una. No se ejecutaron acciones sobre esos casos. Los manifiestos automatizados son distintos y no deben usarse para aceptación.

**Entorno Docker iniciado:** después de la solicitud explícita del usuario, PostgreSQL, backend y frontend están activos. Frontend y API responden por la misma URL local. El bloqueo anterior afectaba al arranque de procesos del host; no se reintentó ese mecanismo. Se usan contenedores propios y el dataset humano preparado, sin ejecutar migraciones ni semillas.

- URL de acceso: `http://127.0.0.1:5197`.
- API: `http://127.0.0.1:5197/api/`; backend interno Docker en8235 (no publicado al host); PostgreSQL dedicado en loopback54701.
- Mantener intactos8231/5179/5194/54697 y los procesos de otros agentes.
- Credenciales sintéticas en `ACCESOS.md`, fuera de Git. La guía privada contiene enlaces por escenario. El usuario realiza el login; no compartir el archivo de accesos.
- La base usa almacenamiento temporal del contenedor. Si se detiene/recrea, no reutilizar manifiestos, IDs ni enlaces anteriores.

## Probar ahora
No es necesario iniciar terminales. Abrir la URL, usar las credenciales privadas de `ACCESOS.md` y seguir el recorrido. No ejecutar `INICIAR-BACKEND.ps1` ni `INICIAR-FRONTEND.ps1`: son instrucciones anteriores al arranque Docker y competirían por el puerto.

## Recorrido principal
1. Iniciar sesión como **operador manual**. Elegir organización A y entrar por **Padrón → persona DECISION → Derechos**. No debe aparecer Derechos en el sidebar ni una segunda búsqueda de persona.
2. Abrir la novedad pendiente, revisar evidencia y escribir motivo. **Conciliar sin aplicar efectos** debe cambiar sólo el estado de la evidencia. La cobertura sigue deshabilitada.
3. Elegir **Habilitar cobertura**, escribir un motivo y aplicar. Esperar a que **Cerrar** se habilite. La lista debe mostrar **Aplicada · Habilitada** y la ficha **Habilitada**.
4. Ir al historial y abrir la novedad enlazada. La evidencia original y el motivo siguen disponibles. Recargar y volver atrás no debe cambiar la persona.

## Casos complementarios
| Caso | Acción | Resultado esperado |
|---|---|---|
| Registro fijo | Desde una ficha, registrar otra novedad con fuente/referencia nuevas. Probar una query `afiliado` contradictoria. | Persona de la ficha preseleccionada y bloqueada; el registro queda para esa persona. |
| Descarte | Crear una novedad nueva y descartarla con motivo. | Evidencia descartada, sin cambio de cobertura ni pérdida de historia. |
| Rectificación | Crear novedad nueva; desde el detalle registrar rectificación. Volver al antecedente. | Ambas evidencias conservadas; antecedente identifica la rectificación y no permite decidir cobertura. Una referencia repetida continúa requiriendo revisión, no se fuerza. |
| APLICADA | Consultar el caso ya preparado. | Decisión histórica visible y enlace al historial; no ofrece aplicar otra decisión. |
| SIN CAMBIOS | Consultar el caso ya preparado. | Resultado sin cambios; no inventa un registro de cambio de padrón. |
| CONFLICTO | Revisar diferencia, confirmar conflicto y conciliar con motivo. | Conciliar no elimina el conflicto; no aparece la acción de aplicar cobertura. |
| Revisión obsoleta | Abrir una novedad pendiente en dos pestañas; resolverla en una y tratar de resolverla con otra decisión en la segunda. | Rechazo de la decisión obsoleta; consultar la versión actual, sin segunda escritura. La ausencia de escrituras también fue verificada automáticamente. |
| FUTURA / FINALIZADA | En Padrón elegir filtro **Todos**, o usar el enlace privado directo, y consultar cada ficha y sus derechos. | El booleano de cobertura no convierte la afiliación en vigente ni la reactiva. |
| HISTORICA | Abrir la evidencia preparada. | El valor histórico ausente no se interpreta como una decisión de cobertura. |
| Auditor | Cerrar sesión e iniciar como auditor manual. | Puede consultar ficha, evidencia e historial, sin controles de escritura. |
| Sin membresía | Usar la cuenta indicada en los accesos privados e intentar las rutas. | Sin acceso al portal del financiador ni evidencia. |
| Organizaciones A/B | Repetir en B; combinar en URL una persona o novedad de A con B. | No expone datos ajenos ni permite operar sobre ellos. |
| Borradores de pantalla | Escribir un motivo sin guardar; cerrar/cancelar el modal sin guardar antes de cambiar pestaña/persona y regresar. El modal abierto bloquea la ficha. | El texto no se transfiere a otro contexto. |
| Compatibilidad | Abrir enlaces legados de Derechos/Novedades, recargar y usar atrás/adelante. | Conserva el alcance; acceso global sigue disponible. |
| Móvil y teclado | Repetir el flujo principal en viewport móvil y con Tab/Enter/Escape. | Controles accesibles, sin desbordamiento horizontal; Escape cierra sólo cuando termina la operación. |

No se automatizan bajas, reingresos, mora, gracia ni reglas OSTEL. Registrar, conciliar y decidir son acciones distintas. La aceptación cubre ambos módulos, no otros módulos clínicos o financieros.

## Registrar el resultado
Por caso: organización, escenario, resultado observado, esperado y captura si falla. No incluir contraseñas. Marcar **aprobado**, **falló** o **no probado**. La aceptación termina sólo cuando el usuario la confirma; healthchecks y tests no la sustituyen.

## Reproducción automatizada
Config propia: `frontend/playwright.derechos-conjunto.config.js`; exige `SALUD_TEST_POSTGRES_URL` con destino loopback54701 y base `salud_financiadores_test`, `SALUD_DERECHOS_PYTHON`, `SALUD_NOVEDADES_MANIFEST` y `SALUD_DERECHOS_CONJUNTO_MANIFEST`. El valor de conexión es privado y no se documenta aquí. Ambos manifiestos deben ser sintéticos nuevos preparados con `preparar_novedades_real.py --manual`. Nunca apuntar estas variables al manifiesto de aceptación humana. La config activa los casos manuales opcionales y administra únicamente sus servidores8235/5197 durante los tests. Ejecutarla sólo con ambos puertos libres y nunca durante aceptación manual; no parar servidores para hacer espacio.

## Operación del entorno Docker
- Contenedores propios: `novedades-joint-frontend`, `novedades-joint-backend` y `novedades-joint-d7802425948f` (PostgreSQL). No detener contenedores ajenos.
- Frontend: bundle actual compilado desde un snapshot sin archivos `.env`, con dependencias ya instaladas. Nginx sirve el bundle en modo de solo lectura y usuario sin privilegios. No es la imagen antigua del frontend.
- Backend: código actual montado en solo lectura, usuario sin privilegios, sin entrypoint de migración/seed. Comparación de dependencias y `pip check` aprobados.
- La base mantiene su guard de destino: Django comparte la red del contenedor PostgreSQL y conecta por loopback. No se cambiaron settings ni permisos del producto.
- Docker agotó sus subredes automáticas; se verificaron las rutas y se crearon dos redes propias, sin borrar redes de otros proyectos: `novedades-joint-manual` (interna) y `novedades-joint-access` (publicación exclusivamente en localhost5197).
- No detener PostgreSQL ni Docker Desktop durante la aceptación: la base usa tmpfs. Se guardó `joint-before-human.dump` en el directorio privado como respaldo previo; su restauración no fue ensayada. Si la base se pierde, detener la prueba y recuperar el entorno antes de reutilizar los enlaces.
- Salud HTTP y pantalla de login verificadas. La comprobación autenticada usa datos automatizados separados; los casos humanos siguen reservados para el usuario.
- Verificación Docker posterior: login → ficha → Derechos → detalle en escritorio y móvil; Enter/Escape, sin desbordamiento ni errores API. Verificador independiente y repetición del agente principal aprobados. No se ejecutaron escrituras de negocio. Identidad de fuentes/bundle comprobada. No sustituye la aceptación humana ni una nueva suite completa.
