# Catálogo geográfico: tarea programada (Railway y otras infraestructuras)

## Qué hace

Una tarea programada mantiene el catálogo territorial propio (provincias,
partidos y localidades) sincronizado con la API pública de Georef. Arranca,
decide si corresponde actualizar, registra la corrida y **termina**. No es un
worker permanente.

El comando es uno solo y no depende del proveedor:

```text
python manage.py sincronizar_geografia --si-corresponde
```

Sólo descarga el catálogo público de Georef. No envía domicilios, personas,
instituciones, financiadores ni lugares manuales. Las búsquedas de la UI leen
el catálogo guardado en PostgreSQL, nunca Georef en línea.

## Cuándo actualiza

`--si-corresponde` reutiliza `corresponde()` de
`backend/apps/geografia/sincronizacion.py`:

| Estado del catálogo | Qué hace la corrida | Resultado registrado |
|---|---|---|
| Vacío | Carga inicial | `publicado` |
| Actualizado hace menos de 7 días | Termina sin llamar a Georef | `omitido` |
| Vencido, sin intento en las últimas 24 h | Actualiza | `publicado` |
| Vencido, con un intento hace menos de 24 h | Termina sin llamar a Georef | `omitido` |
| La descarga falla | Sale con **código distinto de 0** y conserva el catálogo anterior | `fallo` |

Líneas del log:

- `Geografía cron: corresponde actualizar.` y luego
  `Geografía: N entidades; publicado=True.`
- `Geografía cron: catálogo vigente o reintento pendiente; no se descarga.`
- `Falló la sincronización; se conserva el catálogo anterior. Se reintentará en el próximo turno.`

Por eso el cron se programa **a diario**: actualiza una vez por semana y, ante una
falla, reintenta como máximo una vez por día. Los intervalos son duraciones
exactas: una actualización puede ocurrir entre 7 y unos 8 días después de la
anterior. La publicación es transaccional: nunca queda una descarga parcial.

`--si-corresponde` no se combina con `--seco` ni con `--periodico`.
`--periodico` es el bucle del worker `geografia` de Compose (comprueba cada
hora y no termina). Nunca usarlo en un cron.

## Evidencia de la última corrida

Cada corrida con `--si-corresponde` guarda una fila en `geografia.Ejecucion`
(momento, resultado y entidades). Se conservan las últimas 20. La evidencia no
depende de los logs de la plataforma.

`GET /api/geografia/estado/` requiere sesión (un 401 anónimo es esperado) y
devuelve, por ejemplo:

```json
{
  "version": 1,
  "intento": "2026-11-27T18:00:04Z",
  "actualizado": "2026-11-27T18:00:41Z",
  "error": "",
  "ejecuciones": [
    {"momento": "2026-11-28T06:00:03Z", "resultado": "omitido", "entidades": null},
    {"momento": "2026-11-27T18:00:41Z", "resultado": "publicado", "entidades": 5400}
  ]
}
```

- `version` positiva y `error` vacío: hay un catálogo válido publicado.
- `actualizado`: última publicación. `intento`: último intento de descarga.
- `ejecuciones`: corridas del cron, la más reciente primero. Si la primera tiene
  más de 24 horas, el cron no está corriendo.

`/api/health/` no comprueba el catálogo.

## Railway: cómo está versionado

Railway ya no acepta *Config as Code* (`railway.json` / `railway.toml`) en
servicios nuevos y deja de leerlo el 01/01/2027. El servicio se define con
**Infrastructure as Code** en [`.railway/railway.ts`](../../.railway/railway.ts).

- El archivo exporta el *partial* `geografia`. Sólo administra el servicio
  `<prefijo>-geografia` del entorno enlazado. No declara la API, la web, la base
  ni el bucket: un `apply` no puede cambiarlos ni borrarlos.
- El nombre del entorno de Railway elige prefijo y rama: `QA` →
  `plexo-qa-geografia`, rama `qa`; `AGC` → `plexo-agc-geografia`, rama `agc`.
  Otro entorno hace fallar la evaluación; agregarlo al mapa `ENTORNOS`.
- Build: `backend/Dockerfile`, root directory `/backend`.
- Start command: `/entrypoint.sh python manage.py sincronizar_geografia --si-corresponde`.
- Cron `0 6 * * *` UTC (03:00 de Argentina). Restart policy `NEVER`. Una réplica.
  Sin dominio, healthcheck ni volumen.
- Variables: `DATABASE_URL`, `DATABASE_SSL`, `DJANGO_SECRET_KEY` y `ENTORNO` son
  referencias a `<prefijo>-api`; no se copian secretos. Valores fijos:
  `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`,
  `EJECUTAR_MIGRACIONES=0`, `SEED_DEMO=0`, `SEED_GUARDIA=0`, `PYTHONUNBUFFERED=1`.
- La API aplica las migraciones. El cron necesita la API desplegada con el mismo
  código (migración `geografia.0002_ejecucion`).
- `CronGeografiaTest` (`backend/apps/geografia/issue136_test_runtime.py`)
  comprueba que el `startCommand` del archivo invoca esta opción del comando.

### Revisar y aplicar el archivo

Requiere Node 22 o superior y Railway CLI 5.42.1 o superior, ya autenticada.

```powershell
cd .railway
npm ci
railway link            # proyecto PLEXO y el entorno destino
railway config plan     # sólo lee
railway config apply    # sólo si el plan toca únicamente <prefijo>-geografia
```

En Windows con Git Bash, si `plan` dice que la CLI es vieja aunque no lo sea,
la SDK no pudo ejecutar el *shim* de npm. Usar el binario real:

```bash
R="$APPDATA/npm/node_modules/@railway/cli/bin/railway.exe"; _="$R" "$R" config plan
```

**AGC no se aplica** hasta que el analista funcional valide QA. Para replicar en
AGC: `railway link` al entorno AGC, `plan`, revisar y `apply`.

### Estado en QA

| Campo | Valor |
|---|---|
| Proyecto | PLEXO, `5c9e06ca-364f-423f-9ef1-cd41c815b35b` |
| Entorno | QA, `99fa9ab6-f0d7-4cc7-813e-60fd5a86d3e4` |
| Servicio | `plexo-qa-geografia`, `35ba22a2-575b-479f-a173-08b393dcb309` |
| Instancia del servicio | `f3ecb4bb-ce48-40ec-80b7-13e60726abf0` |

El servicio anterior, `cauce-geografia`, se eliminó junto con el entorno demo el
26/11/2026.

### Ejecutar ahora y ver corridas

Un deploy de un cron sólo construye la imagen: no ejecuta la tarea. Para una
corrida manual (equivale a **Run now** del panel):

```powershell
railway api 'mutation { deploymentInstanceExecutionCreate(input:{serviceInstanceId:"f3ecb4bb-ce48-40ec-80b7-13e60726abf0"}) }'
```

Corridas registradas por Railway y logs:

```powershell
railway api 'query { deploymentInstanceExecutions(input:{serviceId:"35ba22a2-575b-479f-a173-08b393dcb309", environmentId:"99fa9ab6-f0d7-4cc7-813e-60fd5a86d3e4"}, first: 10) { edges { node { id status createdAt updatedAt } } } }'
railway logs -p 5c9e06ca-364f-423f-9ef1-cd41c815b35b -e QA -s plexo-qa-geografia --lines 30
```

En los logs debe aparecer `EJECUTAR_MIGRACIONES=0` y nunca migraciones ni seeds.
Un cron que terminó con código 0 no es un servidor caído.

Si el servicio se recrea, el ID de instancia cambia. Obtenerlo con
`railway status --json` (sin listar variables) y actualizar esta tabla.

### Suspender

Quitar el cron del servicio (o desconectar la fuente) y comprobar que no queden
ejecuciones activas. Para que el cambio dure, editar también
`.railway/railway.ts`; si no, el próximo `apply` lo restaura. Suspender no borra
el catálogo: la UI y la carga manual siguen funcionando y el estado avisa la
antigüedad. Detener el cron no deshace una publicación ya confirmada.

## Otra infraestructura

Cualquier programador sirve si cumple tres reglas:

1. Usa la **misma imagen** que la API.
2. **No migra ni siembra** (`EJECUTAR_MIGRACIONES=0`, `SEED_DEMO=0`, `SEED_GUARDIA=0`).
3. **No superpone corridas** ni convive con el worker `--periodico` sobre la misma base.

La API, o un `migrate` previo, debe haber aplicado las migraciones.

### crontab (host con Docker)

```cron
# 06:00 UTC todos los días; el comando decide si descarga.
0 6 * * * docker run --rm --env-file /etc/plexo/geografia.env plexo-backend:<tag> python manage.py sincronizar_geografia --si-corresponde >> /var/log/plexo-geografia.log 2>&1
```

`/etc/plexo/geografia.env` contiene `DATABASE_URL`, `DATABASE_SSL`,
`DJANGO_SECRET_KEY`, `ENTORNO`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=localhost`,
`EJECUTAR_MIGRACIONES=0`, `SEED_DEMO=0` y `SEED_GUARDIA=0`. Permisos `600`; no
versionarlo.

### docker compose

El `docker-compose.yml` ya trae el servicio `geografia` con `--periodico`. Para
reemplazarlo por un cron del host, detener ese servicio y programar:

```bash
docker compose run --rm geografia python manage.py sincronizar_geografia --si-corresponde
```

### Kubernetes

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: plexo-geografia
spec:
  schedule: "0 6 * * *"
  timeZone: "Etc/UTC"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 0          # el comando ya limita los reintentos a uno por día
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: geografia
              image: plexo-backend:<tag>
              command: ["/entrypoint.sh", "python", "manage.py", "sincronizar_geografia", "--si-corresponde"]
              envFrom:
                - secretRef:
                    name: plexo-backend   # DATABASE_URL, DJANGO_SECRET_KEY, ENTORNO...
              env:
                - {name: EJECUTAR_MIGRACIONES, value: "0"}
                - {name: SEED_DEMO, value: "0"}
                - {name: SEED_GUARDIA, value: "0"}
                - {name: DJANGO_DEBUG, value: "0"}
                - {name: DJANGO_ALLOWED_HOSTS, value: "localhost"}
```

En todos los casos, verificar con `GET /api/geografia/estado/`.

## Costo

No queda un contenedor encendido entre corridas, pero cada arranque, build y
descarga consume recursos. Revisar el consumo real en el panel de Railway.

## Historial

- 27/10/2026 (#136): `cauce-geografia` se creó a mano en el entorno demo, con un
  `manage.py shell -c` que envolvía `corresponde()`. Evidencia en el
  [informe de #136](../plans/2026-10-22-issue136-avance.md).
- 26/11/2026: se eliminó el entorno demo y con él el cron.
- 27/11/2026 (#234): el cron pasa a código (`--si-corresponde` y
  `.railway/railway.ts`), guarda historial de corridas y corre en QA.

Referencias: [Cron jobs](https://docs.railway.com/cron-jobs) y
[Infrastructure as Code](https://docs.railway.com/infrastructure-as-code).
