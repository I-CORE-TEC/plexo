# Prueba local de OSTEL #180 / #185

Preparada el 21/10/2026. Todos los datos son ficticios. No importar aquí los archivos reales de OSTEL.

**Comprobación del usuario:** el 21/10/2026 informó «probado», tras la entrega de
habilitación por lote y conflictos de cobertura. No detalló los pasos ejecutados:
esta guía conserva resultados esperados, no una certificación de que cada caso
pasó. La validación local no equivale a homologación de OSTEL ni aceptación de producción.

## Entrar

- Aplicación: http://127.0.0.1:5189/financiadores/padron
- Backend: http://127.0.0.1:8139
- Accesos: `<directorio privado de la prueba>/accesos-locales.json`. Usar primero la cuenta `operador`; luego `auditor`. Las contraseñas no se copian al repositorio.
- Excel: `<directorio privado de la prueba>/prueba-guiada`.
- Organización: **OSTEL - Prueba local ficticia**.

Al preparar la guía, la base conservaba algunos lotes del chequeo automático con personas 0201/0202. Los seis archivos usan personas 0101–0107. La persona 0107 ya existía con habilitación de cobertura; el archivo 06 también se usó en el chequeo real de conflictos y puede repetirse sin duplicarla. Tras la prueba del usuario puede haber más lotes/personas aplicados: revisar el historial antes de repetir; no borrar ni reiniciar la base para recuperar los conteos iniciales.

## Recorrido y resultados esperados

1. **Alta habitual.** Padrón → Registrar afiliación. Usar documento ficticio `99018801`, nombre `PRUEBA MANUAL CON COBERTURA`, número de afiliación `MANUAL-801`, fecha de hoy y el plan ficticio disponible. Completar los campos obligatorios. En Afiliación, **Habilitar cobertura junto con el registro** debe venir marcado; el resumen debe mostrarlo. Guardar: debe aparecer como vigente sin un paso adicional de habilitación. Esto no garantiza una prestación: siguen aplicando plan, fechas, convenio y reglas.

2. **Excepción administrativa.** Repetir con documento `99018802`, nombre `PRUEBA MANUAL ADMINISTRATIVA`, número `MANUAL-802`. Desmarcar la habilitación; se puede dejar sin plan. Guardar y elegir Estado → **Sólo registro administrativo**. Debe aparecer ahí y no en Vigentes. Abrir la ficha, editar la habilitación con motivo y asignar plan si corresponde; guardar y comprobar el cambio de estado. Volver a deshabilitar con otro motivo. Revisar el historial: ambos cambios deben ser trazables. No finaliza la afiliación ni borra a la persona.

3. **Base OSTEL.** Importar Excel → Formato **OSTEL** → desmarcar **Habilitar cobertura** para esta prueba administrativa. Elegir `01-base.xlsx` y Revisar archivo. Esperado: 2 listas, 0 pendientes. Aplicar. Cerrar y filtrar **Sólo registro administrativo**: personas 0101 y 0102, ambas con `FAMILIA-GUIA` como afiliación. Son dos personas; compartir NROAFI no las fusiona. No se debe inferir grupo familiar, plan ni cobertura.

4. **Aplicación parcial y corrección.** Mantener desmarcada **Habilitar cobertura**. Cargar `02-parcial.xlsx`: 1 válida y 1 pendiente. Aplicar la válida; la persona 0103 se incorpora y 0104 queda pendiente. Revisar fila → CUIL `27990186044` → motivo `Verificado contra dato ficticio de la guía` → Guardar y revalidar. Debe quedar lista; aplicar. Elegir Mostrar filas → Aplicadas → Ver detalle de 0104 → Historial de revisiones. Deben conservarse el valor original `123`, la corrección y su responsable. Guardar una corrección por sí solo no aplica la fila.

5. **Identidad contradictoria.** Cargar `03-identidad-conflictiva.xlsx`: las dos filas comparten NUMERO `GUIA-105`, por lo que ambas quedan en revisión y ninguna se incorpora. Corregir el Número interno de 0106 a `GUIA-106`, con motivo. Revalidar también 0105 si sigue pendiente: resolver un conflicto no aplica automáticamente su contraparte. Como alternativa, excluir una fila con motivo y comprobar que queda como Excluida con evidencia conservada. No debe haber una fusión silenciosa.

6. **Cambio entre fuentes.** Después del paso 3, cargar `04-cambio-administrativo.xlsx` manteniendo desmarcada **Habilitar cobertura**. La diferencia de nombre de 0101 requiere revisión. Abrir la fila: deben verse los valores actuales del padrón y los originales del archivo. Confirmar el cambio con motivo, revalidar y aplicar. El nombre cambia; la habilitación, plan y fechas existentes se conservan.

7. **Bajas como evidencia.** Cargar `05-bajas-evidencia.xlsx`. Ya no hay selector de contenido: la fecha de baja en la fila hace que se marque como evidencia, independientemente del checkbox de cobertura. No debe haber filas aplicables ni opción de forzar la baja mediante corrección. La persona 0101 continúa registrada. Excluir la fila tampoco elimina al afiliado. Las fechas y movimientos efectivos siguen pendientes de reglas de OSTEL.

8. **Conservación de cobertura.** Cargar `06-cobertura-existente.xlsx` con **Habilitar cobertura** desmarcado. La persona 0107 ya está habilitada: debe quedar como conflicto y no aplicarse aún. Revisar fila muestra el valor actual y el solicitado. Escribir un motivo, guardar/revalidar y aplicar; debe conservar su habilitación. Repetir con la plantilla del sistema: el conflicto muestra un campo de motivo para conservar la cobertura actual. Para nuevas personas, marcado habilita y desmarcado crea sólo el registro administrativo; las prestaciones siguen sujetas a reglas.

9. **Historial, repetición y exportación.** Cerrar/reabrir Importar Excel y seleccionar un lote previo desde Importaciones registradas; debe abrirse con su formato y detalle correctos. Las filas ya aplicadas no deben ofrecer una nueva aplicación. Volver a subir `01-base.xlsx` puede requerir revisión si el nombre fue cambiado en el paso 6; nunca debe duplicar las personas. Cambiar a Plantilla del sistema, descargarla y verificar que sigue disponible el circuito habitual. En el padrón, seleccionar Todos o Sólo registro administrativo, mostrar la columna Habilitación de cobertura y exportar XLSX; contrastar filas y filtro con la pantalla.

10. **Permisos y UX.** Salir y entrar como `auditor`: consultar padrón e historial disponible en sus pantallas, sin botones de alta/importación/edición. Volver como operador y abrir una corrección: el formato, archivo y cierre se bloquean mientras se edita; Cancelar permite salir sin guardar. Probar también ventana angosta y revisar legibilidad, scroll de la tabla, mensajes y foco. Registrar cualquier incomodidad visual concreta que aparezca al repetir el recorrido.

## Evidencia y límites

- Migración `0013_administrativa_cobertura` aplicada a la base SQLite ficticia, con respaldo anterior `ostel-antes-0013.sqlite3`.
- Chequeo real con navegador, API y SQLite: login operador, carga, aplicación parcial, subsanación, segunda aplicación, historial, filtro administrativo y auditor sin importación: OK.
- Las pruebas técnicas previas cubren alta predeterminada/excepcional, permisos, revisiones concurrentes, preservación de cobertura y consumidores clínicos/financieros. Este recorrido no configura un hospital ni demuestra prestaciones, reservas o liquidaciones completas mediante navegador.
- SQLite tuvo un bloqueo al cargar consultas simultáneas de Inicio. El servidor local usa `--nothreading` para esta demo. Por separado pasaron tres pruebas de concurrencia en PostgreSQL temporal autorizado, ya eliminado; no equivalen a una prueba de rendimiento de producción.
- Volumen aislado: 5.754 altas ficticias y reintento sin duplicación; revisión 10,843 s, aplicación 327,766 s en 58 llamadas y 223,33 MiB de cuerpos JSON acumulados. No mide HTTP ni navegador. Ver la evidencia y límites en [Estado vigente](ostel-aceptacion.md).
- Hay trabajo paralelo de permisos/navegación en el mismo checkout, excluido de los commits OSTEL. La UI local también refleja esos archivos. Las verificaciones corresponden al estado observado, no a una copia inmutable del commit.
- No hubo push, despliegue ni uso de los Excel reales. No restaurar automáticamente una versión antigua: ignorar el nuevo indicador podría tratar registros administrativos como habilitados.

## Reiniciar si se cerró el entorno

En dos terminales, ejecutar respectivamente los scripts `iniciar-backend.ps1` e `iniciar-frontend.ps1` de la carpeta temporal indicada. No hacerlo si los puertos 8139 y 5189 ya están ocupados por esta demo. La base persiste; no hay que volver a migrar ni borrar datos para continuar la guía.

Al terminar, anotar qué pasos pasaron y dónde se apartó el resultado esperado. La aceptación visual y los escenarios de producción siguen separados de los checks técnicos.

## Derechos operativo — guía completa de prueba local aislada

Esta guía cubre el recorrido visible de Derechos implementado: buscar una persona,
seguir evidencia y novedades, revisar la ficha y su historial, conciliar sin
efectos, decidir explícitamente la habilitación administrativa, consultar
Borradores y comparar esa pantalla con reglas/planes. La demostración OSTEL que
precede a esta sección es independiente y no debe mezclarse con estos datos.

### Inicio rápido — entorno ya preparado

1. Abra [Derechos listo para probar](http://127.0.0.1:5179/financiadores/derechos?financiador=7&afiliado=53).
   La pestaña de Orca quedó abierta con el operador y la persona del circuito con plan.
2. Abra `ACCESOS.txt` y `DATOS-Y-RUTAS.md` en el directorio privado indicado en
   la sección 1. El inventario ofrece un enlace por caso. Si expiró la sesión,
   vuelva a ingresar con ese operador.
3. Siga las secciones 3 a 10. Las secciones 1 y 2 son instrucciones de
   recuperación: no vuelva a preparar datos ni iniciar servidores ahora.
4. Para completar el circuito con plan puede usar `extras.integracion_plan`
   en los pasos 5.1 en lugar de `escenarios.decision`: ambos comienzan pendientes
   y deshabilitados. Reserve el otro como segundo caso independiente.

### Alcance y seguridad de la prueba

- Use únicamente los usuarios y las organizaciones sintéticas del manifiesto
  privado. La preparación crea organizaciones A y B, un operador y un auditor
  manuales, y escenarios independientes para cada organización.
- La base permitida es `salud_financiadores_test`, en PostgreSQL de loopback
  (`127.0.0.1:54697`). El backend escucha en `127.0.0.1:8231`; Vite en
  `127.0.0.1:5179`. No use producción, otras bases, expedientes reales ni datos
  clínicos.
- Los comandos de inicio son foreground. No reinicie ni borre la base para
  repetir el recorrido. Cada preparación nueva crea otro conjunto sintético;
  conserve su manifiesto temporal y elija sus propios IDs.
- El PostgreSQL de esta sesión usa un contenedor temporal en memoria. La API y
  Vite respondieron correctamente en `127.0.0.1:8231` y `127.0.0.1:5179`; si se
  detiene el contenedor, la base y sus filas desaparecen. Para repetir después
  de ese cierre, migre la base aislada y prepare un manifiesto NUEVO; no intente
  recuperar IDs del conjunto anterior.
- Algunas acciones son deliberadamente persistentes dentro de esta base
  descartable: conciliar una novedad, cambiar explícitamente la cobertura,
  registrar una rectificación y guardar un borrador. Haga los recorridos en el
  orden indicado y no repita la preparación durante la aceptación.
- La conciliación y la cobertura son acciones distintas. Registrar o conciliar
  evidencia no modifica automáticamente el padrón, la vigencia ni derechos. La
  fecha y el código de la novedad no activan bajas, reingresos, gracia, mora ni
  cambios de plan. No infiera elegibilidad, una prestación o un pago a partir
  de la clasificación o del booleano de cobertura.
- La guía no habilita reglas automáticas ni define reglas normativas o plazos
  legales. T5 continúa fuera de este corte.

### 1. Preparar y reconocer el manifiesto privado

Si el entorno de esta sesión está iniciado y el manifiesto completo fue
preparado, use la ruta privada y no vuelva a ejecutar estos comandos. Para
generar otro conjunto completo en la base aislada, abra PowerShell en la raíz
del worktree `DERECHOS`, use el entorno aislado del paso 2 y ejecute una vez.
El directorio nuevo, los dos manifiestos y los destinos de salida deben estar
en `%TEMP%`; no sobrescriba un archivo anterior.

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$privado = Join-Path $env:TEMP 'derechos-manual-20261113-62369e1abb2f4794952bd003145b1a31'
$completar = Join-Path $privado 'completar_datos.py'
$salida = Join-Path $env:TEMP "derechos-prueba-$([guid]::NewGuid().ToString('N'))"
if (!(Test-Path $completar)) { throw 'Falta la preparación temporal complementaria; no ejecute sólo la fixture base si necesita todos los casos.' }
New-Item -ItemType Directory -Path $salida | Out-Null
$base = Join-Path $salida 'manual.json'
$manifest = Join-Path $salida 'manual-completo.json'
Push-Location "$repo\backend"
try {
  python -B ..\frontend\e2e\fixtures\preparar_novedades_real.py $base --manual
  if ($LASTEXITCODE -ne 0) { throw 'No se preparó la fixture manual base.' }
  python -B $completar $base $manifest
}
finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'No se completó la fixture manual.' }
$env:SALUD_NOVEDADES_MANIFEST = $manifest
Write-Output "Manifiesto privado: $manifest"
$datos = Get-Content -Raw $manifest | ConvertFrom-Json
@(
  "Operador: $($datos.manual.operador)"
  "Auditor: $($datos.manual.auditor)"
  "Administrador: $($datos.manual.admin)"
  "Contraseña de estos tres roles: $($datos.manual.password)"
  "Sin membresía: $($datos.sin_membresia)"
  "Contraseña sin membresía: $($datos.password)"
) | Set-Content (Join-Path $salida 'ACCESOS.txt') -Encoding utf8
```

El manifiesto, el script de complemento y la contraseña aleatoria quedan fuera
del repositorio, en `%TEMP%`. El archivo privado ACCESOS.txt es el lugar para leer las
credenciales; la misma contraseña sintética se usa con `admin`, `operador` y
`auditor`. No las pegue en el repositorio, el chat, logs compartidos ni
capturas. El archivo local `ACCESOS.txt`, dentro del directorio privado de esta
sesión, es el handoff de acceso actual; no se versiona. `manual.organizaciones`
es el conjunto completo de esta guía; el nivel superior `organizaciones`
contiene la fixture E2E estándar y no es el objetivo de esta aceptación. Si
desea comprobar el rechazo por falta de membresía, use el `sin_membresia` y la
`password` del nivel superior, no las credenciales del grupo `manual`.

En esta sesión, los archivos privados están bajo
`%TEMP%\derechos-manual-20261113-62369e1abb2f4794952bd003145b1a31\`:
`ACCESOS.txt` contiene los accesos y `DATOS-Y-RUTAS.md` el inventario. No copie
su contenido al repositorio. Lea las contraseñas sólo en ese archivo local privado.

El script `completar_datos.py` es una preparación temporal de esta sesión, no un
producto ni una fixture durable del repositorio. Si esa carpeta temporal ya no
existe, no hay una receta equivalente versionada para recrear el complemento;
la aceptación debe esperar un nuevo conjunto de datos preparado localmente.
Estos comandos no crean ni migran el contenedor PostgreSQL. Si el contenedor
tmpfs se detuvo, no ejecute el preparador contra otra base ni invente su
reemplazo; solicite un nuevo entorno aislado y genere IDs/manifiestos nuevos.

Para ver sólo IDs, documentos y nombres de escenarios, sin mostrar contraseñas:

```powershell
$datos.manual.organizaciones | ForEach-Object {
  $org = $_
  foreach ($grupo in @('escenarios', 'extras')) {
    $casos = $org.$grupo
    if ($casos) {
      foreach ($clave in $casos.PSObject.Properties.Name) {
        $caso = $casos.$clave
        $persona = if ($caso.afiliado) { $caso.afiliado } else { $caso }
        [pscustomobject]@{
          organizacion = $org.nombre
          organizacion_id = $org.id
          grupo = $grupo
          escenario = $clave
          afiliado_id = $persona.id
          documento = $persona.documento
          novedad_id = $caso.novedad
          historial_id = $caso.historial
        }
      }
    }
  }
} | Format-Table -AutoSize
```

El manifiesto manual completo incluye `decision`, `aplicada`, `sin_cambios`,
`conflicto`, `futura`, `finalizada`, `historica`, `integracion_plan`, `registro`,
`descartar`, `rectificar`, `revision`, `sin_cambio_pendiente`, `desactivar` y
`paginacion`. Incluye un actor `admin`, dos organizaciones manuales A/B, planes
ficticios `Plan Base` / `Plan Alternativo`, una prestación de prueba
`CONSULTA FICTICIA DERECHOS`, reglas de cobertura y un borrador no operativo
`MANUAL-NO-OPERATIVA` v1. Los IDs y documentos cambian en cada preparación. El
plan, la prestación, los porcentajes y los siete días de prueba son datos
sintéticos, no reglas asistenciales ni plazos normativos.

En el manifiesto actual, las organizaciones manuales A/B tienen IDs 7 y 8.
Confirme siempre el `id` del manifiesto si prepara otro conjunto. Ambas organizaciones tienen sus propios planes y personas de integración.

### 2. Iniciar el entorno local

Si el agente dejó ambos servidores activos y sus comprobaciones de salud
pasaron, abra `http://127.0.0.1:5179/financiadores/derechos?financiador=<ID-A>`
y siga con el paso 3. Si se cerraron, conserve la misma ruta del manifiesto y
abra dos terminales PowerShell en la raíz del worktree.

**Estado observado en esta sesión:** API en `127.0.0.1:8231` y Vite en
`127.0.0.1:5179` respondieron HTTP 200. El login del operador y el recorrido
visible persona → novedad → conciliación sin efecto → decisión explícita →
historial se comprobaron con un manifiesto de verificación separado. El diálogo
se operó con teclado/Escape a 390 px, sin desbordamiento horizontal. Los seis
E2E focalizados pasaron en desktop y mobile, sin skips, sobre datos de
verificación aparte. La organización manual A/B permanece fresca y no se usó en
esas comprobaciones. Esto es evidencia técnica del agente, no aceptación humana.

**Terminal 1 — API Django**

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$env:SALUD_NOVEDADES_MANIFEST = '<ruta privada del manifiesto>'
Set-Location "$repo\backend"
python -B manage.py runserver 127.0.0.1:8231 --noreload
```

**Terminal 2 — interfaz Vite**

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$env:SALUD_NOVEDADES_MANIFEST = '<ruta privada del manifiesto>'
$env:VITE_PROXY_TARGET = 'http://127.0.0.1:8231'
Set-Location "$repo\frontend"
npm run dev -- --host 127.0.0.1 --port 5179 --strictPort
```

No cierre esas terminales mientras prueba. No ejecute otra suite ni fixture
contra la misma base durante la aceptación.

### 3. Iniciar sesión y elegir organización

1. Abra la URL del paso 2. Si todavía no hay sesión, la aplicación lo llevará a
   `/login`. Ingrese el email `manual.operador` y la contraseña del manifiesto.
2. Ingrese en la organización A indicada por su ID y nombre en el manifiesto.
   Conserve ese `financiador` en la URL. Las organizaciones A y B contienen
   personas con documentos similares; siempre compruebe nombre e ID, no sólo el
   número de afiliado.
3. Confirme que el menú del financiador muestra `Derechos`. En la página debe
   aparecer `Derechos por persona`, el aviso de que se consulta evidencia
   administrativa sin inferir reglas nuevas y el acceso `Borradores de derechos
   (no operativo)`.

Si el usuario autenticado no pertenece a la organización seleccionada, la
pantalla debe mostrar `No tiene acceso al financiador seleccionado`; no debe
mostrar el menú de Derechos ni consultar la API de esa organización. La fixture
estándar del manifiesto también tiene un usuario `sin_membresia` para probar
esta denegación, si se desea repetir la comprobación negativa.

### 4. U1 — búsqueda, identidad y navegación de la persona

Empiece por `extras.integracion_plan.afiliado` de la organización A. Tiene
un plan ficticio y sirve para recorrer Derechos junto con las reglas de
cobertura sin confundir ambos conceptos.

1. En `Buscar persona por documento, número o nombre`, escriba el documento y
   seleccione `Buscar persona`.
2. En resultados, verifique el nombre, `Afiliado #<ID>` y documento. Elija
   `Seleccionar afiliado #<ID>`.
3. La URL debe conservar `financiador=<ID-A>` e incluir `afiliado=<ID-persona>`.
   La sección `Situación de afiliación` debe mostrar la persona correcta, su
   clasificación, plan (o `Sin plan asignado`) y `Cobertura habilitada`.
4. Use `Ver ficha actual` para abrir la ficha existente y regresar con el
   navegador. Si hay un plan asignado, pruebe `Ver plan`; `Ver reglas de
   cobertura` abre la sección de reglas de servicios, que es distinta de la
   habilitación administrativa de la afiliación.
   Para este caso, la regla está vinculada a la prestación sintética
   `CONSULTA FICTICIA DERECHOS`. Revise el plan/regla allí, vuelva a Derechos y
   confirme que la habilitación de la persona se sigue mostrando como un dato
   administrativo aparte.
5. Vuelva a Derechos y abra una novedad con `Ver detalle`. Cierre el diálogo con
   `Escape` y compruebe que vuelve el foco al control que lo abrió. Ábralo de
   nuevo y ciérrelo con `Cerrar`.
6. Recargue la página. La selección de persona y novedad debe reconstruirse desde
   la URL; no debe quedar una ficha anterior de otra persona.
7. Pruebe atrás y adelante del navegador: al volver a los resultados debe
   desaparecer `afiliado`; al avanzar debe restaurarse la persona elegida. La
   ficha y el detalle de novedad deben coincidir con los IDs de la URL.
8. Elija `Limpiar persona seleccionada` y verifique que se quitan el contexto de
   persona y novedad. Buscar otra persona debe reemplazar la identidad previa.
9. Repita la búsqueda con `escenarios.decision.afiliado.documento` para seguir
   la principal decisión de la sección 5.1.

**Resultado esperado:** consultar y navegar no cambia novedades, padrón, la
cobertura ni historiales.

### 5. U2 — novedades y decisión explícita

#### 5.1 Caso `decision`: conciliar primero, decidir después

Este es el principal recorrido con escritura. Hágalo una sola vez por persona. Puede usar el caso `extras.integracion_plan` de la entrada inicial o `escenarios.decision`.

1. Abra la persona y su novedad `decision`. En el diálogo `Novedad #<ID>`,
   confirme el estado `Pendiente`, la `Evidencia original`, `Al registrar`,
   `Padrón actual` y `Historial de decisiones`.
2. Escriba un motivo en `Motivo de la decisión` y seleccione
   `Conciliar sin aplicar efectos`.
3. Espere la actualización. El estado debe cambiar a `Conciliada sin
   aplicación`. Antes de una decisión de cobertura, verifique en la ficha que
   `Cobertura habilitada` sigue `Deshabilitada`. Conciliar no debe añadir un
   cambio de cobertura ni simular una baja o reingreso.
4. Ahora, en `Estado de cobertura`, elija `Habilitar cobertura`; complete
   `Motivo de la decisión` con el motivo específico de esta decisión y elija
   `Aplicar decisión de cobertura`.
5. En el detalle debe aparecer `Decisión explícita de cobertura` y
   `Cobertura actualizada · Habilitada`, el motivo y `Cambio enlazado al
   historial del padrón #<ID>`.
6. Elija `Ver ficha actual`. La cobertura ahora debe decir `Habilitada`. Abra
   el historial de la ficha: debe haber una entrada cuyo origen es la novedad
   indicada. Vuelva al diálogo con el navegador y verifique que la relación al
   mismo historial sigue visible.
7. En el historial de la ficha, pulse `Ver novedad #<ID>`: debe volver al
   detalle exacto de origen en Novedades, con el mismo financiador y persona.
   Recargue esa URL y compruebe que consulta la evidencia sin repetir la decisión.

**Persistencia esperada:** la acción explícita actualiza sólo el campo de
cobertura administrativa y crea el evento de historial enlazado a esa novedad.
No supone elegibilidad, aprobación de prestación ni pago.

#### 5.2 Caso `aplicada`: valor e historial preexistentes

1. Busque `escenarios.aplicada.afiliado.documento` y abra su novedad.
2. Verifique que la cobertura esté `Habilitada`, el estado de la novedad sea
   `Conciliada sin aplicación` y el detalle tenga el resultado de cobertura
   aplicado con su motivo e ID de historial.
3. Abra `Ver ficha actual` y confirme que el historial enlaza el cambio a la
   novedad indicada en el manifiesto.
4. No debe aparecer el formulario para decidir cobertura otra vez.

Este estado viene preparado; no hay que volver a aplicarlo.

#### 5.3 Caso `sin_cambios`: resultado sin historial ficticio

1. Busque `escenarios.sin_cambios.afiliado.documento` y abra su novedad.
2. Verifique la cobertura `Habilitada` y el resultado `Sin cambios: ya tenía el
   valor elegido`.
3. Abra la ficha y su historial. No debe aparecer un nuevo cambio de afiliación
   creado sólo para repetir el mismo valor. El evento y el motivo de la novedad
   permanecen visibles.

#### 5.4 Caso `conflicto`: padrón actualizado después de registrar evidencia

1. Busque `escenarios.conflicto.afiliado.documento` y abra la novedad
   `conflicto`.
2. El diálogo debe presentar `Revisión de conflictos` con el texto
   `El padrón cambió desde el registro de la propuesta.`; `Padrón actual` muestra
   el nombre actualizado y `Al registrar` conserva el snapshot original.
3. Sin marcar `Revisé expresamente los conflictos y coincidencias indicados`,
   `Conciliar sin aplicar efectos` debe estar deshabilitado.
4. Para ejercitar el reconocimiento explícito del conflicto, marque la casilla,
   ingrese un motivo y concilie. Verifique que la comparación y la advertencia
   quedan en el historial; la cobertura no se actualiza automáticamente.

No intente “arreglar” la evidencia ni fuerce una escritura para quitar el
conflicto. El estado fue preparado deliberadamente para esta revisión.

#### 5.5 Caso `revision`: concurrencia visible en dos pestañas

Este caso cambia datos sintéticos. El rechazo debe dejar la novedad pendiente.

1. En la pestaña A, busque `extras.revision.afiliado.documento`, abra su
   novedad y deje el diálogo abierto. No seleccione `Actualizar comparación`.
2. En una pestaña B, abra la ficha de esa misma persona con el mismo operador y
   financiador. Use un control visible para cambiar un dato administrativo
   permitido (por ejemplo, plan o cobertura si la ficha ofrece esa edición),
   ingrese un motivo y guarde. Anote el valor anterior y el nuevo.
3. Vuelva a la pestaña A, escriba un `Motivo de la decisión` y elija
   `Conciliar sin aplicar efectos` con la comparación vieja.
4. La aplicación debe rechazar la decisión con `La propuesta o el padrón
   cambiaron. Compare nuevamente antes de resolver.`. La novedad permanece
   `Pendiente`; el intento rechazado no agrega conciliación ni habilita
   cobertura.
5. Elija `Actualizar comparación`. El detalle debe advertir `El padrón cambió
   desde el registro de la propuesta.`. Deténgase aquí este caso; no concilie esa
   novedad salvo que quiera completar una decisión explícita aparte.

Este recorrido provoca una revisión optimista obsoleta entre dos pestañas. No
es un replay HTTP. No copie, edite ni reenvíe solicitudes con DevTools.

#### 5.6 Caso `sin_cambio_pendiente`: decisión sin cambiar el valor

1. Abra `extras.sin_cambio_pendiente`; verifique que la novedad está
   `Pendiente` aunque la persona ya figura `Habilitada`.
2. Concilie con un motivo. Después elija `Habilitar cobertura`, escriba un
   motivo y aplique la decisión.
3. Debe aparecer `Sin cambios: ya tenía el valor elegido`. La ficha permanece
   `Habilitada` y el historial de afiliación no recibe un cambio ficticio.

#### 5.7 Caso `desactivar`: decisión explícita en sentido inverso

1. Abra `extras.desactivar`, confirme el valor inicial en la ficha y
   concilie la novedad con un motivo.
2. Elija `Deshabilitar cobertura`, escriba el motivo y aplique la decisión.
3. La ficha pasa a `Deshabilitada`; el detalle enlaza la decisión al historial.
   No se crean efectos sobre vigencia, familia, servicios ni dinero.

#### 5.8 Caso `descartar`: cierre sin aplicar efectos

1. Abra `extras.descartar`, compruebe que está `Pendiente` y anote la
   cobertura que muestra la ficha.
2. Escriba un motivo en `Motivo de la decisión` y elija `Descartar propuesta`.
3. El estado cambia a `Descartada`, el motivo aparece en `Historial de
   decisiones` y la cobertura/historial de afiliación no cambian.

#### 5.9 Caso `paginacion`: conservar los registros de la lista

1. Busque y seleccione `extras.paginacion.afiliado.documento` de A. Confirme
   `Mostrando novedades de la persona #<ID>` y deje `Estado de la novedad` en
   `Todos`. Sólo esa persona tiene las 31 novedades de este caso.
2. Recorra `Siguiente` hasta el final y después `Anterior`. El contador debe
   indicar `Página <n> · 31 novedades`; no deben mezclarse otras personas.
3. Recargue en la segunda página y use atrás/adelante. La URL debe conservar
   persona, estado y página. Abra un detalle y regrese sin perder el contexto.
4. Use `Quitar filtro de persona`: ahora el total puede ser mayor que 31,
   porque se muestran también los otros casos de esa organización.

No concilie ni descarte estas novedades: se usan sólo para la lista y paginación.

#### 5.10 Casos `futura`, `finalizada` e `historica`

1. Busque por separado los documentos de `escenarios.futura` y
   `escenarios.finalizada` para revisar la clasificación y el booleano
   administrativo.
2. La primera debe clasificarse `Futura`; la segunda, `Finalizada`. Ambas pueden
   mostrar `Habilitada` como valor administrativo. La clasificación no cambia
   por ese booleano. No debe presentarse como habilitación prestacional ni
   reactivar la afiliación finalizada.
3. Busque `escenarios.historica.afiliado.documento`, abra su novedad y, en `Al
   registrar`, compruebe que el dato opcional de cobertura se ve `No registrado`.
   No debe completarse ni inferirse desde `Padrón actual`.
4. Abra por separado las novedades pendientes de `extras.futura` y
   `extras.finalizada`. Revise evidencia y clasificación; no las concilie ni
   cambie cobertura en este caso de lectura.

#### 5.11 Caso `registro`: alta visible de una propuesta

Esta acción crea una novedad sintética nueva; complete este caso una sola vez.

1. Abra la persona `extras.registro.afiliado.documento` y elija
   `Registrar novedad`.
2. En `Buscar persona por documento o nombre`, localice la misma identidad; en
   `Persona del padrón`, selecciónela. Complete `Fuente`, `Referencia externa`,
   `Código informado`, `Descripción administrativa` y `Motivo del registro` con
   textos identificados como ficticios. Deje `Fecha informada` vacía para no
   introducir una fecha que se interprete como regla.
3. Elija `Guardar propuesta`. La propuesta debe aparecer como `Pendiente` y
   mostrarse en `Evidencia original`. La cobertura y el historial de afiliación
   deben conservar sus valores.

### 6. Rectificación de evidencia — mutación adicional

Hágalo después de completar los casos anteriores y sólo con la persona y la
novedad indicadas en `extras.rectificar`.
Una rectificación conserva la novedad previa y crea otra propuesta pendiente;
no modifica automáticamente cobertura ni elimina el antecedente.

1. Abra su novedad de antecedente y elija `Registrar rectificación`.
2. El diálogo debe llamarse `Rectificar novedad #<ID>` y mantener bloqueados la
   búsqueda y la persona del padrón. Actualice los campos necesarios: `Fuente`,
   `Referencia externa`, `Código informado`, `Fecha informada`, `Descripción
   administrativa` y `Motivo del registro`. No agregue información clínica ni
   convierta una fecha en una orden.
3. Elija `Guardar propuesta`. Debe crearse otra novedad `Pendiente`; la
   `Evidencia original` debe indicar `Rectifica propuesta #<ID-antecedente>`.
4. Vuelva a abrir el antecedente y confirme que sigue legible y sin cambios. La
   cobertura y el historial de afiliación deben conservar los valores previos.

#### Repetición/replay y revisión optimista

- La interfaz deshabilita controles mientras envía una decisión y refresca la
  comparación. No fuerce doble clic, no reenvíe solicitudes con DevTools y no
  intente reproducir tokens/versiones manualmente.
- La idempotencia de reintentar exactamente la misma decisión y las huellas
  completas de base son contratos técnicos probados mediante API/servicios. No
  reenvíe solicitudes con DevTools. El caso `revision` de arriba cubre el
  rechazo visual por revisión obsoleta; los replay exactos siguen siendo
  evidencia técnica, no una acción manual.

### 7. Auditoría de sólo lectura, organizaciones y roles

1. Cierre la sesión del operador e ingrese como `manual.auditor` con la misma
   contraseña local. Abra la misma organización A y repita la búsqueda,
   consulta de ficha, detalle de evidencia e historial.
2. El auditor debe poder consultar, pero no debe ver controles para registrar,
   conciliar, descartar, rectificar o aplicar la decisión. No intente evadir el
   rol escribiendo en la interfaz.
3. Abra la organización B y repita búsqueda por el documento del caso
   equivalente de B. Confirme que el nombre, el ID y el contenido son de B. Una
   persona de A no debe aparecer en los resultados de B.
4. Conserve una URL con organización A seleccionada, luego cambie a B usando la
   URL de B y regrese a A. No use una pestaña con contexto antiguo para aplicar
   decisiones. Tras cualquier cambio de organización, verifique en la URL y en
   el título que `financiador` coincide con la persona cargada antes de seguir.
5. Si desea verificar la negación por ausencia de membresía, cierre sesión y
   use el `sin_membresia` del manifiesto estándar con una organización estándar.
   Debe aparecer `No tiene acceso al financiador seleccionado` y no debe
   consultarse información de esa organización.

### 8. Borradores, simulación y reglas de cobertura

Las reglas de cobertura responden a prestaciones/categorías y sus condiciones.
La habilitación de Derechos es un estado administrativo de afiliación. Los
Borradores son configuración no operativa: guardar o simular no aprueba ni
activa derechos.

#### 8.1 Compatibilidad de la URL previa desde Derechos

1. Como operador o auditor, en Derechos elija `Borradores de derechos (no
   operativo)`. Debe abrir `/financiadores/borradores?financiador=<ID>` y mostrar
   `Borradores de reglas de derechos` y `Módulo de configuración no operativa`.
2. El rol de consulta no debe mostrar `Guardar borrador`. Elija `Volver a
   Derechos` y confirme que regresa al mismo financiador.
3. Abra un detalle de novedad y compruebe que no aparecen `Estado de cobertura`,
   `Motivo de la decisión` ni `Aplicar decisión de cobertura` para el auditor.

#### 8.2 Admin ficticio: previsualizar, guardar, simular y consultar trazabilidad

Use `manual.admin` sólo en una organización ficticia del manifiesto completo.
El preparador base de novedades no crea admin, plan ni regla; el complemento
temporal de esta sesión sí los prepara. La misma clave sintética se usa para
admin, operador y auditor.

1. Ingrese con ese admin y abra `/financiadores/borradores?financiador=<ID>`
   para su organización ficticia. La lista debe incluir
   `MANUAL-NO-OPERATIVA · v1` y el panel debe permitir `Nueva versión`.
2. En v1, elija `Simular plazo`. Use una fecha, referencia y evidencia
   explícitamente ficticias. La versión ya tiene configurados siete días
   corridos; si ingresa como referencia `2030-01-01` y como fecha `2030-01-08`,
   el resultado debe marcar la relación en el límite. Es un ejemplo de cálculo,
   no un plazo normativo.
3. En `Nueva versión`, complete una v2 con el mismo código, régimen y ámbito
   que v1 (`Todos los planes`); use fechas técnicas válidas, una fuente y un
   motivo claramente ficticios. El plazo opcional puede ser 7 días. No use estos
   textos como política real.
4. Elija `Previsualizar propuesta`. En `Vista previa técnica` compruebe las
   coincidencias antes/después y el mensaje `No se guardaron versiones ni se
   modificaron derechos.`. Vuelva a consultar: la versión aún no debe estar
   guardada.
   Como v1 ya existe en el mismo ámbito, el resultado puede señalar conflicto;
   la pantalla no selecciona la versión “ganadora”.
5. Elija `Guardar borrador`. La pantalla debe indicar que los derechos no
   cambiaron y la versión queda etiquetada `Borrador`. La ficha de persona no
   cambia por este guardado.
6. Vuelva a simular v2 con datos ficticios y confirme que sólo calcula una
   relación temporal; no decide ni activa derechos. La simulación no consulta
   personas ni requiere servicio/catálogo de prestaciones.
7. Abra `Ver trazabilidad`. Debe identificar quién registró cada versión,
   cuándo, el motivo, fuente y ámbito. Su texto aclara que no es aprobación ni
   decisión de derechos.
8. Ingrese como auditor de esa organización; debe poder consultar versiones y
   trazabilidad, pero no guardar una nueva.

La pantalla `Ver reglas de cobertura` es una ruta diferente. Abra el caso
`extras.integracion_plan` y verifique la regla de la prestación ficticia
`CONSULTA FICTICIA DERECHOS`. Los datos de servicio pertenecen a cobertura, no
al estado de habilitación de la afiliación ni al borrador simulado. No registre
una regla nueva durante la aceptación.

### 9. Escritorio, móvil y teclado

Repita al menos la búsqueda, apertura/cierre de detalle y navegación a ficha e
historial en escritorio y en un viewport móvil. En ambos tamaños verifique:

- los campos y acciones se pueden leer sin scroll horizontal inesperado;
- los botones permanecen visibles y no se superponen al diálogo;
- la evidencia original y el historial mantienen su orden y no se cortan;
- el foco sigue el orden de lectura con `Tab` y vuelve con `Shift+Tab`;
- `Enter` activa el botón enfocado; `Espacio` activa una casilla o botón
  enfocado; `Escape` cierra el diálogo y devuelve el foco al control anterior;
- el nombre accesible del buscador es `Buscar persona por documento, número o
  nombre`; el detalle se anuncia como `Novedad #<ID>`;
- no hace falta usar sólo color para distinguir estados y errores.

Anote cualquier problema visible con el ancho, navegador, tamaño de pantalla,
rol, organización, ID de persona/novedad y pasos reproducibles. No concluya
aceptación por el hecho de que el servidor responda.

### 10. Orden recomendado, evidencia y límites

| Orden | Caso | ¿Escribe en la base ficticia? | Verificación principal |
|---|---|---:|---|
| 1 | U1 búsqueda, ficha, URL, volver/avanzar y recarga | No | Identidad y contexto coinciden con la URL |
| 2 | `aplicada`, `sin_cambios`, `futura`, `finalizada`, `historica` | No | Valor, clasificación y evidencia preparada |
| 3 | `conflicto` | Sí, sólo si decide reconocerlo y conciliar | Se muestra el conflicto; sin habilitación automática |
| 4 | `decision`: conciliar y después habilitar explícitamente | Sí | Evento de cobertura enlazado a la novedad |
| 5 | Rectificación | Sí | Nueva propuesta enlazada, antecedente intacto |
| 6 | Auditor y aislamiento A/B | No | Lectura permitida y contexto de organización separado |
| 7 | Borradores: vista previa, guardar y simulación (admin) | Vista previa/simulación: no; guardar: sí | Guardado permanece no operativo |
| 8 | Móvil, escritorio y teclado | No, salvo que repitas una acción anterior | Flujo operable sin mouse |

Guarde como evidencia la ruta y la captura sin datos reales ni credenciales,
rol/organización/caso, el resultado visible y cualquier diferencia. Para casos
que escriben, anote el valor antes/después y el ID de historial; no use
limpieza destructiva como verificación.

La suite automatizada de `frontend/e2e/derechos-operativos-real.spec.js` cubre
contratos de navegación, permisos, escenarios sintéticos y casos que requieren
inspección de API/base. Esa evidencia técnica no reemplaza su aceptación visual,
el uso real de teclado ni una homologación. El replay exacto de solicitudes y
las comprobaciones de huella de base son técnicos y no se deben simular con
DevTools.

### Plantilla de registro de prueba

```text
Fecha y hora local:
Worktree y rama:
URL local:
Navegador / viewport:
Actor (operador, auditor o admin ficticio):
Organización / ID:
Escenario / afiliado / novedad:
Precondición confirmada:
Pasos ejecutados:
Resultado visible esperado / observado:
Antes / después en ficha e historial (si aplica):
¿Hubo escrituras?:
Captura o evidencia (sin credenciales ni datos reales):
Resultado: aprobado / fallido / no ejecutado
Detalle del fallo y pasos para repetir:
```

### Checklist de cierre

- [ ] U1 búsqueda, persona, URL, recarga, atrás/adelante, ficha e historial.
- [ ] Conciliación sin efecto automático y decisión explícita con motivo.
- [ ] Casos aplicados, sin cambios, conflicto, futuro, finalizado e histórico no
      registrado.
- [ ] Registro de nueva propuesta y descarte sin efectos sobre la afiliación.
- [ ] Decisión pendiente sin cambios y deshabilitación explícita con motivo.
- [ ] Revisión obsoleta en dos pestañas rechazada sin efectos adicionales.
- [ ] Paginación de 31 novedades, filtros y recarga conservan el contexto.
- [ ] Historial abre la novedad exacta; cargar la URL no repite una decisión.
- [ ] Rectificación conserva la evidencia previa y enlaza el antecedente.
- [ ] Auditor puede consultar, pero no decidir ni guardar.
- [ ] Organización A/B no mezcla personas ni detalles; no se use un contexto
      viejo para decidir.
- [ ] La URL previa de Borradores sigue siendo consultiva para roles sin admin.
- [ ] Admin preparado: vista previa, guardado no operativo, simulación y
      trazabilidad; las reglas/servicios siguen siendo otra sección.
- [ ] Escritorio, móvil, Tab, Shift+Tab, Enter, Espacio y Escape revisados.
- [ ] Se informaron los fallos, las limitaciones y los casos técnicos no
      reproducibles manualmente.
