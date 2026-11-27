# Padrón mensual de OSTEL

Cada mes OSTEL envía su padrón. **Importar padrón OSTEL del mes** muestra qué cambió, lo aplica con historial y deja para revisión manual solo los conflictos reales. Reemplaza a la gestión manual de Novedades, que se retiró (#219).

## Cómo se agrupa el lote

| Grupo | Cuándo | Qué hace al aplicar |
|---|---|---|
| Altas | El documento no está en el padrón y la fila no informa baja. | Crea el afiliado (`registrar_afiliado`). |
| Modificaciones | El afiliado existe y está vigente. Se muestra antes y después por campo. | Actualiza identidad y ficha (`editar_ficha`). |
| Bajas | La fila trae FECBAJ, ESTADO=B o viene del archivo de bajas. | Finaliza la afiliación al final del día FECBAJ (`finalizar_afiliacion` con fecha). |
| Reingresos | Un afiliado finalizado vuelve a aparecer sin baja. | Reactiva con su plan anterior, desde FECING (`reactivar_afiliacion` con fecha). |
| Conflictos | Identidad contradictoria o repetida, o fechas inconsistentes. | No se aplica. Se corrige u omite en la misma pantalla (`subsanar`). |

Reglas fijas:

- **La ausencia en el lote no genera baja.**
- **FECVTO nunca se usa como baja.** Se conserva como dato original.
- Son conflictos de fechas: FECBAJ anterior a FECING o al inicio de la afiliación en el padrón, FECBAJ futura, ESTADO=B sin FECBAJ, baja de alguien que no está, baja de alguien ya finalizado con otra fecha, y reingreso sin plan anterior activo, sin FECING válida, con FECING futura o no posterior a la baja anterior.
- **Baja repetida:** si OSTEL repite una baja que ya está registrada con la misma fecha, la fila figura como «Ya registrada» y no pide nada. Con otra fecha es un conflicto.
- **Cobertura:** la opción «Habilitar cobertura» del lote sólo rige las altas. Las personas existentes conservan su cobertura y no se marca conflicto aunque difiera de la opción.
- El archivo real no trae un código de movimiento R. Por eso un reingreso se reconoce por el estado del afiliado en el padrón.

## Cómo se aplica

1. Cargar el archivo y revisar la vista previa por grupo.
2. Escribir un **motivo del lote**. Queda en el historial de cada afiliado y en la auditoría, con el lote como origen. Las filas limpias no piden motivo propio.
3. Aplicar los grupos elegidos. Las bajas exigen una confirmación explícita del operador.
4. Cada fila se vuelve a validar al aplicarse. Si el padrón cambió, la fila pasa a conflicto.

API: `POST /api/financiadores/{id}/previsualizar-ostel/`, `POST /api/financiadores/{id}/aplicar-ostel/` con `{importacion, grupos, motivo, confirmar_bajas}` y `POST /api/financiadores/{id}/subsanar-ostel/`. `confirmar-importacion` sigue disponible para el padrón mensual (conserva la respuesta acotada por tandas), pero exige `motivo` del lote y sólo aplica altas y modificaciones. Los lotes preparados antes de este cambio se pueden leer, pero no aplicar: hay que cargar el archivo de nuevo.

## Límites

- Gracia, mora, subsidios y excepciones se resuelven en #216. No bloquean aplicar bajas administrativas.
- Si una persona fue atendida entre la FECBAJ y el día de aplicación, esas atenciones quedan registradas tal como están.
- Fuera de alcance: catálogo de causales, precedencia entre fuentes, períodos superpuestos e integraciones ARCA, ANSES o SSSalud.

Seguimiento de la implementación: `odd/tasks/issue-219-padron-mensual.md`.
