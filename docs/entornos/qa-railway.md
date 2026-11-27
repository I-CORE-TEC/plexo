# Entorno QA en Railway

QA es donde el analista funcional prueba antes de que algo llegue a AGC. Vive en
el proyecto **PLEXO** de Railway (`5c9e06ca-364f-423f-9ef1-cd41c815b35b`),
entorno **QA** (`99fa9ab6-f0d7-4cc7-813e-60fd5a86d3e4`).

| Servicio | Qué es | URL pública |
|---|---|---|
| `plexo-qa-web` | SPA (nginx, `frontend/`) | <https://plexo-qa-web-qa.up.railway.app> |
| `plexo-qa-api` | Django + gunicorn (`backend/`) | <https://plexo-qa-api-qa.up.railway.app/api/health/> |
| `plexo-qa-db` | PostgreSQL 16 | solo red privada |

## Flujo de ramas

```text
main ──PR──▶ qa ──PR──▶ agc        (más adelante: prd)
              │           │
              ▼           ▼
          Railway QA   Railway AGC
```

1. Todo entra a `main` por PR con CI verde.
2. Para llevarlo a QA se abre un PR `main → qa` y se mergea. Ese push a `qa`
   despliega **solo** `plexo-qa-api` y `plexo-qa-web` (los dos servicios están
   conectados a la rama `qa` del repo `I-CORE-TEC/plexo`, sin "Wait for CI").
3. Cuando el analista valida QA, se abre un PR `qa → agc`. La rama `agc` está
   protegida por un ruleset que solo acepta cambios por PR.

## Configuración versionada (config as code)

Cada servicio lee su configuración de build y deploy desde el repo:

| Servicio | Root directory | Config file |
|---|---|---|
| `plexo-qa-api` | `/backend` | `/backend/railway.json` |
| `plexo-qa-web` | `/frontend` | `/frontend/railway.json` |

- El **config file** se indica con ruta absoluta desde la raíz del repo: Railway
  no lo busca dentro del root directory.
- El `dockerfilePath` va **relativo** (`Dockerfile`), y se resuelve dentro del
  root directory. Con `/Dockerfile` (absoluto) Railway lo buscaba en la raíz del
  repo, donde no hay Dockerfile: todos los builds desde GitHub fallaban con
  `failed to read Dockerfile at 'Dockerfile'` (diagnosticado el 27/11/2026).
- Las variables (claves, dominios, `VITE_API_URL`, `NGINX_CONF`, base de datos)
  **no** van en el archivo: siguen en las variables del servicio en Railway.

### Migraciones

Las aplica el propio contenedor de la API al arrancar: `entrypoint.sh` corre
`migrar_con_candado` mientras `EJECUTAR_MIGRACIONES` valga `1` (es el valor en
QA). Si una migración falla, el contenedor no arranca, el healthcheck de
`/api/health/` no pasa y Railway deja vivo el deploy anterior.

### Variables que dependen de los dominios

Si cambia un dominio público, hay que actualizar a mano:

- API: `DJANGO_ALLOWED_HOSTS` (incluye `healthcheck.railway.app`),
  `CORS_ALLOWED_ORIGINS` y `PORTAL_URL_BASE` (dominio de la web).
- Web: `VITE_API_URL` (`https://<api>/api`). Vite lo incrusta en el build, así
  que un cambio exige redeploy de la web.

## Diagnosticar un deploy fallido

```bash
P=5c9e06ca-364f-423f-9ef1-cd41c815b35b
E=99fa9ab6-f0d7-4cc7-813e-60fd5a86d3e4

# Últimos deploys, con estado y commit
railway deployment list -p $P -e $E -s plexo-qa-api --json

# Logs de build (falla antes de arrancar) o de runtime (falla al arrancar)
railway logs --build -p $P -e $E -s plexo-qa-api --lines 100 <deployment-id>
railway logs --deployment -p $P -e $E -s plexo-qa-api --lines 100 <deployment-id>

# Smoke
curl -i https://plexo-qa-api-qa.up.railway.app/api/health/
curl -I https://plexo-qa-web-qa.up.railway.app/
```

Qué mirar según dónde falla:

| Síntoma | Causa habitual |
|---|---|
| `failed to read Dockerfile` | `dockerfilePath` absoluto o root directory mal puesto |
| Build ok, healthcheck falla | migración rota, `DATABASE_URL` o `DJANGO_ALLOWED_HOSTS` sin `healthcheck.railway.app` |
| La web carga pero el login falla | `VITE_API_URL` o `CORS_ALLOWED_ORIGINS` no coinciden con los dominios |

Para reintentar el último commit de `qa` sin pushear nada, usar **Redeploy** en
el panel del servicio. No usar `railway up` para QA: sube el directorio local y
el deploy deja de corresponder a un commit de la rama.
