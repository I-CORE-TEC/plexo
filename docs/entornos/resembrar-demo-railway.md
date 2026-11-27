# Resembrar PLEXO QA (Railway)

La demo compartida se carga **manualmente** en `plexo-qa-api` del proyecto
PLEXO, entorno **QA**. Los flags autorizan los comandos; activarlos, arrancar
o redesplegar la API **no** siembra ni borra datos.

| Entorno | `SEED_DEMO` | `SEED_DEMO_OSTEL` |
|---|---|---|
| QA de Railway | `True` | `True` |
| AGC y producción | `False` | `False` |

Cada flag acepta `True`/`False`, `true`/`false` y `1`/`0`; por defecto está
apagado. `ENTORNO=produccion` bloquea ambos seeds y `reset_datos`, incluso
si se intentan habilitar. El nombre del entorno de Railway no reemplaza `ENTORNO`.

> **No usar `railway run`.** Ejecuta el código de tu máquina con las variables
> del servicio, contra la base remota: corre otra versión del código y deja los
> archivos en tu disco en lugar del bucket.

## Qué camino elegir

| Necesito… | Camino | ¿Borra datos? |
|---|---|---|
| Dejar la demo como nueva | [A. Resembrado completo](#a-resembrado-completo) | **Sí, toda la base y los archivos del bucket** |
| Que la demo parezca recién cargada a una hora fija | [B. Completo anclado](#b-resembrado-completo-anclado) | **Sí, todo** |
| Agregar OSTEL a una demo que no lo tiene | [C. Solo OSTEL](#c-solo-ostel) | No |
| Rehacer OSTEL porque se ensayó sobre él | Camino A (no hay borrado parcial) | **Sí, todo** |
| Renovar el turno y la sala de espera de la paciente del portal | [D. Solo el portal del paciente](#d-solo-el-portal-del-paciente) | No |
| Comprobar que todas las cuentas entran | [Verificar los ingresos](#verificar-los-ingresos) | No |

## Antes de empezar

1. **CLI de Railway** con sesión iniciada (`railway login`) y una clave SSH
   registrada en tu cuenta (`railway ssh` ofrece registrarla la primera vez).
2. **Vincular una carpeta fuera del repo**, una sola vez:

   ```bash
   mkdir -p ~/railway-plexo-qa && cd ~/railway-plexo-qa
   railway link --project 5c9e06ca-364f-423f-9ef1-cd41c815b35b \
     --environment 99fa9ab6-f0d7-4cc7-813e-60fd5a86d3e4 --service plexo-qa-api
   ```

   Los comandos de esta guía se corren desde esa carpeta.
3. **Shell:** los bloques usan sintaxis de bash (en Windows, Git Bash). Los
   que mandan un script por `<<'EOF'` no funcionan en PowerShell.
4. **`railway ssh` a veces da *timeout* al conectar** (`Connection timed out`
   al puerto 22). No es un error de la demo: repetir el comando.

## A. Resembrado completo

`seed_entorno_demo` **vacía toda la base** y carga la demo general. Si el bucket
está configurado, también borra los archivos anteriores de `uploads/` y
`facturas/` después del commit. Conserva archivos ajenos a esos prefijos y los
adjuntos nuevos de la demo. Mientras corre, las tablas quedan bloqueadas.

### 1. Avisar y elegir el momento

- Avisar al equipo: se pierde todo lo que hayan cargado u operado en la demo.
- **No promover ni redesplegar QA mientras corre.** Si el contenedor se
  reemplaza antes del commit, PostgreSQL revierte la transacción.

### 2. Comprobar el bucket (solo lee)

```bash
railway ssh --service plexo-qa-api -- python manage.py shell -c "from apps.demo import archivos; print(len(archivos.claves_a_vaciar()), 'archivos en el bucket')"
```

Confirmar primero que QA sí usa el bucket y que su acceso funciona: cero
también puede significar que el bucket o el flag están deshabilitados. Si falla
el acceso, **no sembrar** hasta corregir y repetir la comprobación.

### 3. Lanzar la carga desacoplada

`railway ssh` corta las sesiones largas (unos 2 minutos), pero el proceso
remoto sigue. Para saber cuándo termina y si falló, la carga se lanza
desacoplada de la sesión, con la salida y el código de salida en `/tmp`:

```bash
railway ssh --service plexo-qa-api -- sh <<'EOF'
cd /app
rm -f /tmp/seed-entorno.log /tmp/seed-entorno.exit
setsid nohup sh -c 'PYTHONUNBUFFERED=1 python manage.py seed_entorno_demo --noinput > /tmp/seed-entorno.log 2>&1; echo $? > /tmp/seed-entorno.exit' < /dev/null > /dev/null 2>&1 &
echo "Lanzada en el contenedor $(hostname)"
EOF
```

Anotar el nombre del contenedor que imprime.

### 4. Seguirla hasta que termine

Repetir cada uno o dos minutos:

```bash
railway ssh --service plexo-qa-api -- sh <<'EOF'
echo "Contenedor: $(hostname)"
if [ ! -f /tmp/seed-entorno.log ]; then
  echo "No hay ninguna carga en este contenedor."
else
  echo "Código de salida: $(cat /tmp/seed-entorno.exit 2>/dev/null || echo 'todavía corre')"
  tail -n 5 /tmp/seed-entorno.log
fi
EOF
```

- **Código 0:** terminó bien. El log cierra con `Entorno de demo cargado en N s`
  y la tabla de usuarios.
- **Otro código:** revisar `/tmp/seed-entorno.log`. Si falló antes del commit,
  la base vuelve atrás y no se borran los objetos anteriores. Los uploads no
  son transaccionales y pueden quedar objetos huérfanos.
- **Cambió el contenedor** o no hay registro de la carga: comprobar base y
  bucket antes de decidir si repetir; no asumir que el proceso no hizo commit.

### 5. Cargar OSTEL

`seed_entorno_demo` no incluye OSTEL. Sobre la base recién cargada:

```bash
railway ssh --service plexo-qa-api -- python manage.py seed_ostel_demo
```

Imprime un JSON con `"existente": false` y el inventario creado. Si la sesión se
corta antes de ver la salida, volver a correrlo es seguro: con `"existente": true`
solo devuelve el inventario, sin cambiar nada.

### 6. Verificar

Seguir [Verificar los ingresos](#verificar-los-ingresos) y estos casos de QA:

1. **#136 – domicilio legado:** en el padrón de Mutual del Valle buscar
   `99029901` (`FICTICIO QA Domicilio Legado`). Abrir la ficha y comprobar que
   conserva los tres textos del domicilio y muestra «Sin homologar».
2. **#171 – adjunto clínico:** en Hospital Central buscar a Andrea Paniagua
   (`FIC100011`). El hemograma del portal incluye un PDF marcado como ficticio.
   Usar la URL de descarga protegida con un usuario sin `historia_clinica` y
   comprobar un `403` sin contenido del PDF ni redirección. El enlace del portal
   del paciente usa otro acceso y no sirve para esta comprobación.
3. **#171 – persistencia:** en Facturas de Mutual del Valle descargar
   `qa-factura-ficticia.pdf` de la primera factura de demo (`DEMO-<id>-001`).
   QA necesita `SALUD_FACTURAS_ADJUNTOS=True`. Registrar el SHA-256 de los bytes,
   redesplegar sólo la API (no resembrar), volver a descargar y comparar.
4. **#171 – vaciado:** tras una recarga completa, comprobar que las claves
   anteriores de `uploads/` y `facturas/` desaparecieron y que las nuevas de
   los puntos 2 y 3 siguen disponibles. El bucket no queda vacío.

## B. Resembrado completo anclado

Para una demo que tiene que verse recién cargada a una hora fija (por ejemplo,
cargarla la noche anterior). Es el camino A con `--ancla` en el paso 3; la
línea del `setsid` queda así:

```bash
setsid nohup sh -c 'PYTHONUNBUFFERED=1 python manage.py seed_entorno_demo --noinput --ancla 2026-10-30T09:00 > /tmp/seed-entorno.log 2>&1; echo $? > /tmp/seed-entorno.exit' < /dev/null > /dev/null 2>&1 &
```

La hora es local (`AAAA-MM-DDTHH:MM`). Hasta esa hora la aplicación muestra datos
con fecha futura, y lo que se opere antes queda desordenado: después de ensayar,
volver a cargar con la misma ancla. Las autorizaciones abiertas vencen unas 48 h
después del ancla.

OSTEL (paso 5) no tiene ancla: se carga con la hora real.

## C. Solo OSTEL

`seed_ostel_demo` **agrega** el escenario OSTEL sin tocar el resto. No tiene
opción de borrado.

```bash
railway ssh --service plexo-qa-api -- python manage.py seed_ostel_demo
```

| Resultado | Qué significa |
|---|---|
| JSON con `"existente": false` | Se cargó ahora; las fechas de las solicitudes Benítez son relativas a la carga |
| JSON con `"existente": true` | Ya estaba. No restablece claves, permisos, pendientes ni fechas |
| `Hay identificadores reservados de OSTEL sin marcador completo` | Alguien creó datos con nombres de OSTEL a mano, o quedó una carga rota. **Investigar antes de tocar nada** |
| `El marcador OSTEL está incompleto o cambió su alcance` | Lo mismo: investigar, no reparar a mano |

**No hay forma de rehacer solo OSTEL.** Si se ensayó sobre él y hay que dejarlo
como nuevo, el único camino es el A (resembrado completo y después OSTEL). No
borrar datos a mano para «forzar» una recarga: el comando rechaza a propósito
cargar sobre restos.

Más detalle del escenario: [Operación técnica del escenario OSTEL](operacion-demo-ostel.md).

## D. Solo el portal del paciente

`seed_portal_demo` crea o **pone al día** la cuenta de Andrea Paniagua
(`andrea.paniagua@paciente.test`): turno reservado, estudios y lugar en la sala
de espera de Cardiología. Ya corre como último paso de `seed_entorno_demo`. Suelto
sirve para renovar el turno o la sala de espera después de haberlos usado en un
ensayo, sin vaciar nada:

```bash
railway ssh --service plexo-qa-api -- python manage.py seed_portal_demo
```

Necesita que la base tenga la carga completa: si falta la paciente en Hospital
Central, falla y pide correr el camino A. La clave es la de `DEMO_PASSWORD`.

La paciente del portal de OSTEL (`paciente@ostel.demo.test`) es de
`seed_ostel_demo` y no se renueva así.

## Verificar los ingresos

Todas las cuentas usan la clave de `DEMO_PASSWORD`. En QA, obtenerla por el
canal acordado; no usar el valor local público. La clave **se fija al sembrar**:
cambiar la variable después no cambia las cuentas existentes.

**Una cuenta suelta:** definir y exportar `QA_API_URL` con el dominio vigente
de `plexo-qa-api`. Leer la clave sin escribirla en el historial:

```bash
read -r -s -p 'Clave de la demo QA: ' DEMO_PASSWORD; echo
export DEMO_PASSWORD
python -c 'import json, os; print(json.dumps({"email": "admin@ostel.demo.test", "password": os.environ["DEMO_PASSWORD"]}))' | \
  curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" --data-binary @- \
  "$QA_API_URL/api/auth/token/"
```

`200` es OK. Para las cuentas del portal del paciente la ruta es
`/api/mi/cuenta/ingresar/`.

**Todas las cuentas.** Primero la lista, desde la base:

```bash
railway ssh --service plexo-qa-api -- sh <<'EOF' | sed -n 's/^CUENTAS=//p' > cuentas.json
cd /app && python manage.py shell <<'PY'
import json
from apps.accounts.models import Usuario
from apps.portal.models import CuentaPaciente
inst = [u.email for u in Usuario.objects.filter(is_active=True).order_by("email") if u.has_usable_password()]
portal = list(CuentaPaciente.objects.filter(activa=True, email_verificado_at__isnull=False).order_by("email").values_list("email", flat=True))
print("CUENTAS=" + json.dumps({"institucionales": inst, "portal": portal}))
PY
EOF
```

Después, el ingreso de cada una (en tu máquina):

```bash
python - cuentas.json <<'PY'
import json, os, sys, time, urllib.request, urllib.error
API = os.environ["QA_API_URL"].rstrip("/")
RUTAS = {"institucionales": "/api/auth/token/", "portal": "/api/mi/cuenta/ingresar/"}
cuentas, fallidas, total = json.load(open(sys.argv[1])), [], 0
for tipo, ruta in RUTAS.items():
    for email in cuentas[tipo]:
        total += 1
        datos = json.dumps({"email": email, "password": os.environ["DEMO_PASSWORD"]}).encode()
        pedido = urllib.request.Request(API + ruta, datos, {"Content-Type": "application/json"})
        try:
            codigo = urllib.request.urlopen(pedido, timeout=30).status
        except urllib.error.HTTPError as error:
            codigo = error.code
        if codigo != 200:
            fallidas.append((email, codigo))
        time.sleep(0.3)
print(f"{total - len(fallidas)} de {total} OK")
for email, codigo in fallidas:
    print(f"  FALLA {email}: {codigo}")
PY
unset DEMO_PASSWORD
```

**Límites de ingreso:** el institucional bloquea después de 10 fallos por email
y 100 por IP cada 15 minutos (los ingresos exitosos no cuentan). El del portal
cuenta todos los intentos: 30 por hora por IP, 10 por email e IP y 50 por email. Si
la clave está mal, la verificación completa gasta esos cupos rápido: probar
antes una cuenta suelta.

## Lo que no se usa en la demo de Railway

- **`seed_volumen --rehacer`**: vuelve a correr `seed_guardia` (que borra los
  casos) y el volumen, pero no las demás cargas que `seed_entorno_demo` arma
  sobre esos casos (finanzas, financiadores, farmacia, portal). Es para la base
  local de desarrollo; en la demo compartida, camino A.
- **Los `seed_*` sueltos** que encadena `seed_entorno_demo` (`seed_guardia`,
  `seed_financiadores`, `seed_comprador`…): dependen del orden y algunos se
  niegan a correr sobre datos ya cargados (`seed_financiadores`, por ejemplo).
  En la demo, siempre por el camino A.
- **`seed_padron_demo`**: exige una base PostgreSQL llamada `padron130`; es para
  el entorno del padrón, no para esta demo
  ([guía](guia-demo-padron-local.md)).
- **`seed_demo` y `SEED_GUARDIA`**: corresponden a escenarios locales de
  desarrollo. Mantener `SEED_GUARDIA=0` en Railway.
