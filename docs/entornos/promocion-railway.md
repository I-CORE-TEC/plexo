# Promoción de PLEXO de QA a AGC

Los cambios se integran primero en `qa`. Para entregarlos a AGC, abre un
pull request desde `qa` del repositorio canónico hacia `agc`. No uses una
rama de trabajo ni un fork como origen de la promoción.

| Entorno | Rama | Servicios Railway |
| --- | --- | --- |
| QA | `qa` | `plexo-qa-web`, `plexo-qa-api` |
| AGC | `agc` | `plexo-agc-web`, `plexo-agc-api` |

En ambos entornos Web compila desde `/frontend` y API desde `/backend`.
El Dockerfile se selecciona por su ruta relativa al directorio del servicio.
No se conecta `prd` a este flujo.

## Verificar una promoción

1. En QA, verifica que Web y API terminaron en `SUCCESS` para el commit
   que vas a promover. No uses un despliegue anterior como prueba.
2. En el PR hacia `agc`, verifica el origen canónico `I-CORE-TEC/plexo:qa`,
   el CI y los dos checks de despliegue de QA que exige GitHub.
3. Después del merge, verifica en Railway que Web y API de AGC hayan iniciado
   desde el nuevo commit de `agc` y hayan terminado en `SUCCESS`.
4. Comprueba que Web y `/api/health/` de API respondan HTTP 200. Si falla un
   servicio, conserva la evidencia del despliegue y no repitas el merge.

GitHub bloquea el push directo a `agc` y exige los checks de la Railway App.
El origen del PR se revisa explícitamente: esos checks se asocian al commit
y no garantizan por sí solos que la rama de origen sea `qa`.
`Wait for CI` no está activo en Railway; los checks de QA se exigen al
promover a AGC, no como requisito del trigger de Railway.
## Apertura automática del PR

Al fusionar un PR hacia `qa`, GitHub Actions abre o reutiliza el PR desde
`qa` hacia `agc`. No lo aprueba ni lo fusiona. Si la rama `qa` no tiene
commits nuevos para promover, no abre un PR.

El workflow usa una GitHub App privada instalada únicamente en
`I-CORE-TEC/plexo`. La App necesita **Pull requests: Read and write** y
**Contents: Read-only** para comparar ramas y **Metadata: Read-only**. No tiene permiso de escritura en **Contents**, ni
excepciones a las reglas de ramas.

En el environment de GitHub Actions `agc-promotion`, limitado a la rama
`qa`, configura la variable `AGC_PROMOTION_APP_CLIENT_ID` y el secreto
`AGC_PROMOTION_APP_PRIVATE_KEY`. La clave se carga directamente en GitHub;
no se guarda en el repositorio. El workflow usa un token temporal limitado
al repositorio. No hace falta permitir que GitHub Actions apruebe PRs.
