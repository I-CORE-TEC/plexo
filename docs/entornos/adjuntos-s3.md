# Recrear y verificar el bucket privado de adjuntos

La [definición versionada](../../infra/attachments.json) declara el destino
Railway y las variables de Django con ejemplos sin secretos. **Reconstruye la
configuración, no los objetos borrados**. Usa un bucket por entorno y conserva
una copia independiente de los datos que no puedas regenerar.

## Railway QA

Desde la raíz, con Python 3.10+ y la CLI Railway autenticada (verificada con
5.63.1), ejecuta:

```sh
python -B infra/railway/attachments.py QA
python -B infra/railway/attachments.py QA --check
```

En Windows, si instalaste la CLI con npm y solo tienes el wrapper en el
PATH, agrega a ambos comandos:

```powershell
--railway-executable "$env:APPDATA/npm/node_modules/@railway/cli/bin/railway.exe"
```

El script solo admite destinos declarados; hoy, QA. Comprueba proyecto,
entorno y API antes de escribir. Crea el bucket si falta y actualiza solo las
variables administradas que difieren. Guarda referencias al bucket, no
claves copiadas. No despliega la API: los cambios se aplican en el próximo
despliegue. Si hay cambios pendientes o un bucket homónimo sin instancia en QA,
revisa el estado en Railway antes de reintentar; no apliques cambios ajenos.
Evita ejecutar la creación en paralelo para el mismo entorno.

**Verificación:** con la CLI enlazada al proyecto PLEXO, consulta el contador de
objetos sin listar claves ni leer archivos:

```sh
railway bucket info --environment QA --bucket plexo-qa-adjuntos --json
```

`--check` detecta referencias faltantes o sin resolver. No prueba el despliegue
activo: tras desplegar, sube y descarga un adjunto sintético, compara SHA-256 y
elimina solo ese objeto. Para probar persistencia, repite la descarga después
de otro despliegue aprobado.

## Otro proveedor S3 (AWS, R2, MinIO o SeaweedFS)

1. Crea un bucket privado por entorno. Usa HTTPS fuera del entorno local.
2. Da a la API credenciales limitadas a ese bucket: listar y leer, escribir y
   borrar los objetos que administra. Inyecta las variables del manifiesto
   desde el gestor de secretos. Django rechaza una configuración S3 parcial.
3. Conserva las claves existentes (`uploads/`, `facturas/`, `prescripciones/`);
   la base no guarda URLs. Antes del corte, pausa las escrituras, copia las claves
   y compara el inventario y los hashes. La API controla los permisos de descarga.
4. Para contar sin modificar objetos, configura un perfil de solo lectura y
   ejecuta lo siguiente en Bash (AWS CLI pagina automáticamente):

   ```sh
   aws --profile adjuntos-lectura --endpoint-url "$ENDPOINT" s3 ls \
     "s3://$BUCKET/" --recursive --summarize | grep '^Total Objects:'
   ```

### Ejemplo local sin Railway

Define `ACCESS_KEY_ID` y `SECRET_ACCESS_KEY` con valores descartables
y `BUCKET=plexo-local-adjuntos` en un archivo local fuera del repositorio.
El puerto S3 solo se publica en loopback; el volumen conserva los objetos al
reiniciar. El inicializador crea el bucket si falta.

```sh
docker compose --env-file /ruta/adjuntos.env -f infra/s3/compose.yml up -d
docker compose --env-file /ruta/adjuntos.env -f infra/s3/compose.yml ps -a
```

Confirma que `bucket-init` terminó con código 0. Pasa esas tres variables a
Django en el host y añade `ENDPOINT=http://127.0.0.1:8333`,
`REGION=us-east-1` y `BUCKET_ADDRESSING_STYLE=path`. Si quieres probar
facturas, añade `SALUD_FACTURAS_ADJUNTOS=true`. El ejemplo es local, no
una instalación endurecida para producción.

## Rotar claves sin recrear el bucket

- **Railway:** agenda una ventana de mantenimiento. El reset en *Credentials*
  invalida el par previo; mantén las referencias intactas, ejecuta `--check`,
  despliega la API y verifica el acceso. No uses una salida que muestre claves.
- **Otro proveedor:** si admite dos pares activos, crea el nuevo, cambia ambas
  claves juntas, despliega, verifica y revoca el par anterior.

El versionado de este repositorio no equivale al versionado de objetos:
[Railway no lo ofrece](https://docs.railway.com/storage-buckets). Para datos
reales, prevé respaldo externo y prueba restauración antes de depender del
bucket.
