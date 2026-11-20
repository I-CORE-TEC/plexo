# Consulta de prestaciones y pagos: contrato de lectura

La consulta separa estimaciones de cobertura y pagos efectivamente registrados.
No crea casos, reservas, cargos, autorizaciones, movimientos ni cambios de derechos.
Las consultas generan los eventos de auditoría previstos por el portal.

## Estimar cobertura

`POST /api/financiadores/{id}/simular-prestacion/`

Cuerpo: `{afiliado, prestacion, fecha, cantidad}`. La fecha usa formato ISO y la
cantidad es un entero positivo. La prestación pertenece al catálogo hospitalario
accesible por convenio; la afiliación debe pertenecer a la organización consultada.
Operador y auditor necesitan su membresía de lectura vigente.

La respuesta distingue cobertura completa, parcial, no cubierta y evaluación
pendiente. Devuelve importes estimados y comprobaciones sobre afiliación, plan
actual, convenio, reglas, cupos y arancel. No reconstruye un plan histórico ni
confirma una autorización para una atención concreta. Información ausente no
equivale a cobertura aprobada. No devuelve una firma de reserva.

## Consultar pagos registrados

`GET /api/financiadores/{id}/ficha-afiliado/?afiliado={persona}&estado=realizada&pagos=true`

Añade `pago_financiador` únicamente a las filas de la página ya autorizada. Incluye
obligación actual, ajustes, pagos netos aprobados, deuda, devolución y operaciones
pendientes. Reutiliza el cálculo de Finanzas; una cuenta saldada por ajuste no se
presenta como un pago. Conserva las restricciones existentes de acceso histórico.
Sin `pagos=true`, JSON mantiene su contrato anterior; CSV no incorpora la proyección.
La combinación `pagos=true&formato=csv` devuelve HTTP 400 con un error en `pagos`,
porque los saldos están disponibles únicamente en JSON. CSV sin `pagos` o con
`pagos=false` conserva su exportación habitual.

## Verificación y reversión

`python manage.py test apps.financiadores.test_consulta_derechos --settings=config.settings_financiadores_test --noinput`

La suite aislada comprueba permisos, pertenencia, datos ausentes, fechas, cupos,
autorización, pagos y ausencia de efectos de negocio. La regresión PostgreSQL
completa registrada en la guía conjunta incluye concurrencia; no debe ejecutarse
sobre los datos de aceptación humana.

La unidad API comprende `consulta_derechos.py`, sus pruebas y las dos extensiones
aditivas de `views.py`. Revertir también el consumidor UI si ya está integrado;
no requiere migración ni reversión de datos persistidos.
