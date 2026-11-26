# Atlas vivo de PLEXO · piloto

El atlas es un HTML autónomo que se abre sin conexión. El piloto mantiene **F1: Cobertura y copago** (incluye reserva, realización y liberación) y **F4: Autorizaciones**. El mapa general y los otros 21 recorridos conservan sus enlaces y se leen como referencia del 25/11/2026. No se considera que el atlas acredite despliegue ni aceptación.

## Abrir el atlas en PLEXO

Escriba **/atlas** en la URL de PLEXO. Use la sesión habitual de un superusuario activo, fuera de «Ver como». No hay botón, enlace de menú ni una copia pública en los archivos estáticos. Sin sesión, PLEXO solicita iniciar sesión; con otro perfil, deniega el acceso.

La API verifica los permisos en cada solicitud de contenido y no permite almacenamiento en caché HTTP. El HTML se ejecuta dentro de un marco aislado, sin acceso a la aplicación que lo contiene. El contenido viaja en la imagen del backend, no en la compilación pública del frontend.

## Generar la copia autónoma

Desde la raíz del repositorio, con Python 3.12 o posterior:

```sh
python docs/atlas/atlas.py build --output atlas-plexo.html
python -m unittest discover -s docs/atlas -p test_atlas.py
```

Abra el HTML resultante en el navegador. No agregue el archivo generado al PR. No necesita levantar PLEXO ni instalar librerías.

## Mantener un recorrido dentro del mismo PR

1. Revise los flujos y rutas vigiladas en [pilot.json](../../backend/atlas_content/pilot.json). Un cambio de pantalla, actor, decisión o traspaso de datos puede cambiar el recorrido. La lista detecta candidatos, no todas las dependencias.
2. Si cambia el comportamiento observable, edite [F1](../../backend/atlas_content/f1.html) y/o [F4](../../backend/atlas_content/f4.html). Conserve el ID del capítulo y los enlaces que ya se usan. Junto con el cambio, vincule la evidencia en el manifiesto si es un archivo permanente, o describa en el PR el escenario y resultado observado. No copie datos reales.
3. Si no cambia el flujo aunque haya rutas vigiladas, escriba una línea por flujo en la descripción del PR. Por ejemplo: `Atlas F1: sin impacto — el refactor no altera actores, decisiones ni pantallas`. No modifique un diagrama sólo para silenciar un aviso.
4. Genere el HTML y siga las flechas modificadas, sus alternativas y los saltos a otros recorridos. La revisión funcional del PR valida el significado de cada decisión: el comprobador sólo valida estructura y detecta cambios potencialmente relevantes.

| Etiqueta del piloto | Qué acredita |
| --- | --- |
| Comportamiento documentado | Referencia a código, pruebas o documentación inspeccionada; no hubo un recorrido en vivo para esta versión del atlas. |
| Probado en un entorno de prueba | Registrar entorno, escenario sintético y resultado. No implica despliegue ni aceptación. |
| Propuesta | Camino futuro en discusión; no se presenta como comportamiento disponible. |

## Aviso de GitHub

El workflow del piloto toma los archivos cambiados y la descripción del PR, genera el HTML en el directorio temporal del runner y emite avisos cuando faltan una actualización o una declaración de impacto. No escribe en GitHub, no sube el HTML, no modifica checks existentes ni despliega. En el piloto, no configure este job como obligatorio.

Reproducción local del aviso desde Git Bash o Linux (la lista usa separadores NUL para respetar nombres con espacios):

```sh
git diff --name-only --no-renames -z BASE...HEAD -- > /tmp/atlas-paths
python docs/atlas/atlas.py review --changes /tmp/atlas-paths --body /ruta/descripcion-pr.txt
```

Revise falsos positivos y omisiones antes de extender el piloto. No reemplace el atlas de referencia ni haga que el job bloquee PR sin otra decisión.
