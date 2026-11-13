# Gestión manual de novedades

## Qué cambia
La lista y el detalle distinguen el estado de la evidencia (pendiente, conciliada o descartada) del resultado de la decisión de cobertura (sin decisión registrada, aplicada o sin cambios).
La decisión registrada es un antecedente: no garantiza que siga siendo el estado actual del padrón. Para comprobarlo, consultar la ficha y el historial.

## Recorrido
1. Abrir la ficha del afiliado y la pestaña **Derechos**. La persona queda fija; también se conserva el acceso global a Novedades.
2. Registrar evidencia y revisar las diferencias antes de conciliar o descartar con un motivo.
3. Leer **Siguiente paso**. Conciliar no obliga a decidir cobertura. Sin respaldo suficiente, conservar la novedad sin decisión.
4. Cuando corresponda y no haya bloqueos, un operador autorizado elige el estado y registra el motivo. Se reutiliza la operación manual existente.
5. Consultar el resultado registrado y el historial de la ficha. Una decisión ya registrada no admite otra decisión distinta sobre la misma novedad.

## Bloqueos
- Si cambió el padrón o se repite una referencia, revisar la ficha y las propuestas relacionadas. Actualizar la comparación consulta los datos actuales; no borra conflictos.
- Confirmar conflictos para conciliar no habilita por sí solo una decisión de cobertura.
- Una propuesta rectificada muestra accesos a las rectificaciones. Revisar la evidencia posterior; no forzar el antecedente.
- Una propuesta descartada no admite una decisión de cobertura. La nueva evidencia se registra mediante rectificación, sin borrar la historia.
- El auditor consulta sin acciones de escritura. Las validaciones definitivas siguen en el backend, incluso si los datos cambian mientras el detalle está abierto.

## Contrato y límites
La lista agrega `habilitacion_cobertura`: `null` o un resumen con `resultado`, `cobertura_habilitada` y `registrado`. El detalle agrega `rectificaciones`, con hasta 100 identificadores del mismo financiador, tipo y versión. No se modifica `efectos_aplicados`, las escrituras, los permisos ni el formato persistido.

Se conserva `personaFija`: prevalece sobre la query y el formulario; no permite cambiar persona. Se conservan los reinicios de borrador, el rechazo de novedades ajenas y las invalidaciones de novedades/ficha.

No se activan reglas automáticas de OSTEL, bajas, reingresos, gracia, mora, cambios de plan ni efectos familiares, asistenciales o financieros. Las futuras reglas necesitan fuente, versión, vigencia, simulación y activación expresa; esta entrega no implementa ese motor.

## Verificación
- API: `manage.py test apps.financiadores.test_novedades_gestion apps.financiadores.test_novedades --settings=config.settings_financiadores_test --noinput`, con `PYTHON_DOTENV_DISABLED=1`, entorno de desarrollo y sin URLs de base externa. SQLite en memoria; no prueba concurrencia PostgreSQL.
- UI propia: `npx --no-install playwright test --config playwright.novedades-gestion.config.js`. Puerto aislado 5195, API interceptada y proxy a un puerto cerrado. Desktop, móvil, teclado, decisiones, bloqueos y auditor.
- Integración del otro agente: `npx --no-install playwright test --config playwright.derechos-ficha.config.js`. Sin editar sus pruebas ni usar el entorno manual.
- Build: `npm run build -- --outDir <directorio-temporal>`.

Resultados y pendientes se registran en `odd/tasks/novedades-gestion-manual.md`. Las pruebas de navegador con API simulada no acreditan el recorrido con backend real ni aceptación humana.
