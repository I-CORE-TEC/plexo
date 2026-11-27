# Derechos de cobertura: comportamiento actual

**Una persona tiene cobertura si cumple estas cuatro condiciones a la vez:**

1. Su registro tiene la cobertura habilitada.
2. Su afiliación no está finalizada.
3. Su fecha de alta (`desde`) ya llegó.
4. Su financiador está activo.

Si falta una, no se autorizan prestaciones nuevas.

La regla está en un solo lugar: `tiene_cobertura(afiliado, fecha)` en
`backend/apps/financiadores/vigencias.py`. Para filtrar en la base de datos se
usa su equivalente, `q_cobertura`. Las autorizaciones, la evaluación de
cobertura, el acceso a la historia clínica, el padrón, la consulta de
prestaciones y la migración de legado usan la misma regla. Cada uno agrega sus
propias condiciones, por ejemplo el convenio vigente o el plan activo.

## Motivos

`tiene_cobertura` devuelve si la persona tiene cobertura y un motivo:

| Motivo | Significado |
|---|---|
| `vigente` | Tiene cobertura. |
| `sin_cobertura` | Es un registro sólo administrativo: la cobertura no está habilitada. |
| `finalizada` | La afiliación se finalizó. |
| `futura` | La fecha de alta todavía no llegó. |
| `financiador_inactivo` | El financiador está desactivado. |

Las evaluaciones históricas no cambian. Un caso o un cargo ya registrado
conserva la cobertura que tenía en ese momento.

## Cómo cambia la cobertura de una persona

Hoy cambia sólo por una acción humana:

- **Finalizar afiliación** en la ficha corta la cobertura.
- **Novedades:** una novedad conciliada permite habilitar o quitar la cobertura,
  con historial y auditoría.
- **Importación del padrón:** cada lote elige si las altas entran con la
  cobertura habilitada o como registros sólo administrativos.

La baja informada por OSTEL (FECBAJ) **no** corta la cobertura sola. Tampoco lo
hace un vencimiento (FECVTO).

## Lo que informó OSTEL (06/11/2026)

- FECING es el ingreso del período y FECBAJ es la baja del período.
- FECHA_A es una fecha de auditoría. No viene en el archivo de 40 columnas que
  se importa hoy.
- FECVTO es un vencimiento operativo, no una baja efectiva.
- MOTIVO puede estar cargado antes de que la baja se ejecute.
- Se admiten bajas fuera de fin de mes.

## Pregunta abierta a OSTEL

> ¿La baja (FECBAJ) corta la cobertura asistencial ese mismo día, o hay gracia
> o mora? ¿Cuántos días y para qué régimen?

Cuando llegue la respuesta, se agrega un parámetro por financiador dentro de
`tiene_cobertura`, con pruebas que usen los ejemplos de OSTEL. Hasta entonces,
la cobertura se corta a mano con **Finalizar afiliación**.

## Padrón: etiqueta «Financiador inactivo» (#216)

El estado de cobertura del padrón sale de una sola función de backend,
`derecho_padron` (con su equivalente ORM `expr_derecho_padron`). La usan el
listado y su filtro `estado`/`derecho`, la exportación, el campo `derecho` de
cada fila y la ficha del afiliado (`ficha-afiliado`, que también conserva
`estado`). El frontend muestra el `derecho` que envía el servidor en lugar de
deducirlo de `vigente`.

Valores, en orden de precedencia: `finalizadas`, `administrativas`, `futuras`,
`financiador_inactivo` («Financiador inactivo», valor nuevo) y `vigentes`.
Antes, un afiliado de un financiador inactivo aparecía como «Vigente» en el
filtro y como «Aún no vigente» en la tabla.

Este orden de etiquetas no es el de los motivos de `tiene_cobertura`
(`sin_cobertura` → `finalizada` → `futura` → `financiador_inactivo`). Sólo
cambia qué etiqueta gana cuando fallan varias condiciones. `vigentes` coincide
exactamente con la regla: es `vigentes` si y sólo si `tiene_cobertura` es
verdadero.

## Admisión usa la regla única (#216)

El resumen de Admisión (`resumenes_administrativos`) ya listaba sólo
afiliaciones con cobertura (`afiliados_vigentes()`) de financiadores activos.
Ahora también decide si cada una es seleccionable con `tiene_cobertura`, más el
control de plan activo. Conserva los mensajes «Registro sólo administrativo,
sin habilitación de cobertura.» y «El plan está inactivo. Revisá el padrón con
el financiador.»; cualquier otra causa usa «La afiliación no está vigente para
una nueva selección. Los casos anteriores conservan su afiliación.».

## Retirado el 26/11/2026 (#216)

Se retiraron los borradores de reglas de derechos, el simulador de plazo, la
trazabilidad de versiones y sus endpoints `borradores-derechos*`, junto con la
sección "borradores" del portal. Ningún flujo de cobertura los usaba y no
otorgaban ni quitaban derechos.

La tabla `BorradorReglaDerechos` se eliminó con la migración
`financiadores.0022_retirar_borradorregladerechos`. Antes de borrarla, la
migración archiva cada fila que quede como un evento de auditoría
`EventoCobertura` con acción `retirar_borrador_derechos`, objeto
`BorradorReglaDerechos:<id>`, el mismo financiador y autor, y un resumen
(código, versión, régimen, plan, vigencia, plazo y motivo original, hasta 255
caracteres). Con la tabla vacía no escribe nada. El borrado de datos es de una
sola vía: revertir la migración recrea la tabla vacía y los eventos quedan como
rastro. La historia de ese desarrollo está en el
historial de git de `ostel-aceptacion.md`.
