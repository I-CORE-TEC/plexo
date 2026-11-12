# Prueba local de OSTEL #180 / #185

Preparada el 21/10/2026. Todos los datos son ficticios. No importar aquí los archivos reales de OSTEL.

**Comprobación del usuario:** el 21/10/2026 informó «probado», tras la entrega de
habilitación por lote y conflictos de cobertura. No detalló los pasos ejecutados:
esta guía conserva resultados esperados, no una certificación de que cada caso
pasó. La validación local no equivale a homologación de OSTEL ni aceptación de producción.

## Entrar

- Aplicación: http://127.0.0.1:5189/financiadores/padron
- Backend: http://127.0.0.1:8139
- Accesos: `C:/Users/Juanito/AppData/Local/Temp/salud-ostel-180-zd1jg1g3/accesos-locales.json`. Usar primero la cuenta `operador`; luego `auditor`. Las contraseñas no se copian al repositorio.
- Excel: `C:/Users/Juanito/AppData/Local/Temp/salud-ostel-180-zd1jg1g3/prueba-guiada`.
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

## Derechos operativo — preparación manual aislada

Esta guía es aparte de la demostración OSTEL anterior. Prepara usuarios y
organizaciones manuales que no comparten cuenta ni afiliados con la fixture E2E
habitual. Sólo usa la base ficticia PostgreSQL `salud_financiadores_test` por
loopback. No carga archivos OSTEL, no inicia reglas de derechos, no afecta
familias/prestaciones/dinero y no limpia ni reinicia datos existentes.

### Preparar datos y leer accesos localmente

Abra PowerShell en la raíz del worktree `DERECHOS`. Ejecute una vez:

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$env:SALUD_DERECHOS_E2E_AISLADO = '1'
$env:SALUD_DERECHOS_PYTHON = 'python'
$manifest = Join-Path $env:TEMP "derechos-manual-$([guid]::NewGuid().ToString('N')).json"
Push-Location "$repo\backend"
try { & $env:SALUD_DERECHOS_PYTHON -B ..\frontend\e2e\fixtures\preparar_novedades_real.py --manual $manifest }
finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'No se preparó la fixture manual.' }
$env:SALUD_NOVEDADES_MANIFEST = $manifest
Write-Output "Manifiesto privado: $manifest"
$datos = Get-Content -Raw $manifest | ConvertFrom-Json
$datos.manual | Select-Object operador, auditor, password, organizaciones | ConvertTo-Json -Depth 8
```

El manifiesto queda en `%TEMP%`. Sus contraseñas aleatorias se muestran sólo en
esta consola local. No las copie al repositorio, a logs compartidos, al chat ni a
capturas. Conserve la ruta impresa para las dos terminales siguientes. La misma
clave sirve para los dos usuarios manuales; seleccione `operador` o `auditor`
según el paso.

### Iniciar los dos servidores bajo control del usuario

Abra dos terminales PowerShell en la raíz del worktree. En cada una, reemplace
`<ruta privada impresa>` por el manifiesto de esta preparación. Ambos comandos
son foreground: permanecen activos hasta que el usuario los detenga con Ctrl+C.
Los intentos anteriores de iniciar servidores persistentes fueron denegados por
el runtime y el demo persistente continúa bloqueado. No se reintentan aquí; esta
sección sólo entrega comandos foreground para que los ejecute el usuario.

**Terminal 1 — backend**

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$env:SALUD_DERECHOS_E2E_AISLADO = '1'
$env:SALUD_NOVEDADES_MANIFEST = '<ruta privada impresa>'
Set-Location "$repo\backend"
python -B manage.py runserver 127.0.0.1:8231 --noreload
```

**Terminal 2 — frontend**

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$env:DJANGO_SETTINGS_MODULE = 'config.settings_financiadores_postgres_test'
$env:DJANGO_DEBUG = 'true'
$env:PYTHON_DOTENV_DISABLED = '1'
$env:ENTORNO = 'desarrollo'
$env:SALUD_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:54697/salud_financiadores_test'
$env:SALUD_DERECHOS_E2E_AISLADO = '1'
$env:SALUD_NOVEDADES_MANIFEST = '<ruta privada impresa>'
$env:VITE_PROXY_TARGET = 'http://127.0.0.1:8231'
Set-Location "$repo\frontend"
npm run dev -- --host 127.0.0.1 --port 5179 --strictPort
```

Abra `http://127.0.0.1:5179/financiadores/derechos?financiador=<ID manual>`.
Use uno de los IDs y documentos de `manual.organizaciones` del manifiesto; no
use organizaciones de `organizaciones` (la fixture E2E estándar). No corra otra
prueba contra la misma base mientras realiza la aceptación.

### Escenarios esperados y aceptación humana

- **Listo para decidir:** la novedad aparece pendiente. Conciliarla no cambia
  `cobertura_habilitada` ni agrega historial de cobertura. Después, el operador
  elige habilitar explícitamente, escribe un motivo y confirma. El historial
  queda enlazado a la novedad.
- **Ya aplicado:** la persona muestra el valor actualizado y el historial
  existente enlazado a esa novedad.
- **Sin cambios:** la novedad registra `sin_cambios`; el historial de afiliación
  no inventa un cambio.
- **Evidencia obsoleta/conflicto:** la resolución se rechaza, conserva la
  novedad pendiente y no cambia la cobertura.
- **Futura y finalizada:** ambas pueden mostrar `Habilitada` como valor
  administrativo; la clasificación `Futura`/`Finalizada` sigue prevaleciendo.
  Ese booleano no las vuelve elegibles ni garantiza prestaciones.
- **Histórico opcional ausente:** en la evidencia inicial aparece `No
  registrado`; no se completa ni se infiere el dato faltante.

Checklist con operador y auditor:

- [ ] Operador: buscar y abrir una persona; navegar por teclado con Tab, Shift+Tab,
  Enter/Espacio y Escape; verificar que el foco y los nombres accesibles permitan
  operar el detalle sin mouse.
- [ ] Operador: conciliar sin efectos; luego realizar sólo la decisión explícita
  del escenario preparado y abrir el historial asociado.
- [ ] Operador: revisar aplicada, sin cambios, conflicto, futura, finalizada e
  histórico no registrado según el manifiesto.
- [ ] Auditor: repetir consultas; confirmar que puede leer evidencia e historial,
  pero no ve controles de decisión ni puede aplicar cambios.
- [ ] Repetir a ancho de escritorio y móvil; observar foco, lectura, scroll y
  mensajes. Anotar diferencias reales en vez de asumir aceptación.

La prueba automatizada corre desktop y móvil, pero no sustituye la comprobación
manual de teclado, la aceptación humana ni una homologación. No hay URL activa ni
servidores listos por el agente. La política T5 sigue fuera de alcance; esta
fixture sólo prepara estados sintéticos y reutiliza transiciones existentes.
