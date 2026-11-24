"""Fresh synthetic consultation data; never point at an existing application database."""
import argparse
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
from decimal import Decimal
from uuid import uuid4

if os.environ.get("DJANGO_SETTINGS_MODULE") != "config.settings_financiadores_postgres_test":
    raise RuntimeError("Explicit isolated PostgreSQL test settings required.")
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))
import django
django.setup()
from django.db import connection, transaction
from django.utils import timezone
from apps.accounts.models import Usuario
from apps.casos.models import Caso, EventoCaso
from apps.finanzas.cobros import registrar_politica_cobro
from apps.finanzas.dinero import registrar_movimiento
from apps.finanzas.models import Prestacion
from apps.finanzas.services import registrar_atencion_completada
from apps.flujos.models import Flujo, Nodo, VersionFlujo
from apps.instituciones.models import Area, Institucion
from apps.registros.models import Ciudadano
from apps.financiadores.cobertura import cotizacion, reservar, seleccionar_afiliacion
from apps.financiadores.models import (
    ConfiguracionHospital, Convenio, Financiador, MembresiaFinanciador, Plan,
    PrestacionComun, ReglaCobertura, ReservaCobertura, VinculoPrestacion,
)
from apps.financiadores.services import registrar_afiliado

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("manifest", type=Path, help="New private manifest under the system temporary directory.")
args = parser.parse_args()
destination = args.manifest.resolve()
database = connection.settings_dict
if database["NAME"] != "salud_financiadores_test" or database["HOST"] not in {"127.0.0.1", "localhost", "::1"}:
    raise RuntimeError("Dedicated synthetic loopback database required.")
if Path(tempfile.gettempdir()).resolve() not in destination.parents or destination.exists():
    raise RuntimeError("A new manifest outside the repository under TEMP is required.")

with transaction.atomic():
    marker = uuid4().hex[:10]
    password = secrets.token_urlsafe(24)
    admin = Usuario.objects.create_superuser(f"closure-admin-{marker}@example.invalid", password)
    operator = Usuario.objects.create_user(f"closure-operator-{marker}@example.invalid", password)
    scenarios = []
    for suffix in ("desktop", "mobile"):
        hospital = Institucion.objects.create(nombre=f"Synthetic hospital {suffix} {marker}")
        area = Area.objects.create(institucion=hospital, nombre="Synthetic consultations")
        flow = Flujo.objects.create(institucion=hospital, area=area, titulo="Synthetic consultation")
        version = VersionFlujo.objects.create(flujo=flow, numero=1)
        node = Nodo.objects.create(version=version, tipo=Nodo.Tipo.ATENCION, titulo="Synthetic consultation")
        document = f"closure-{marker}-{suffix}"
        citizen = Ciudadano.objects.create(institucion=hospital, nombre="Synthetic", apellido=suffix, documento=document)
        case = Caso.objects.create(institucion=hospital, version=version, ciudadano=citizen, area_actual=area)
        service = Prestacion.objects.create(institucion=hospital, nodo=node, codigo="SYNTH", nombre="Synthetic consultation")
        org = Financiador.objects.create(nombre=f"Synthetic insurer {suffix} {marker}", tipo="obra_social")
        MembresiaFinanciador.objects.create(financiador=org, usuario=operator, rol="operador")
        ConfiguracionHospital.objects.create(institucion=hospital, activo=True)
        plan = Plan.objects.create(financiador=org, codigo="BASE", nombre="Synthetic base")
        common = PrestacionComun.objects.create(codigo=f"SYN-{marker}-{suffix}", nombre="Synthetic consultation", categoria="consultas")
        VinculoPrestacion.objects.create(prestacion=service, comun=common)
        Convenio.objects.create(financiador=org, institucion=hospital, estado="activo", propuesto_por="plataforma", creado_por=admin)
        today = timezone.localdate()
        affiliate = registrar_afiliado(financiador=org, usuario=operator, numero=f"SYN-{suffix}", documento=document,
            nombre=f"Synthetic {suffix}", plan=plan, desde=today)
        ReglaCobertura.objects.create(financiador=org, plan=plan, prestacion=common, porcentaje=Decimal("80"),
            cupo=6, periodo="anio", vigente_desde=today, creado_por=admin)
        registrar_politica_cobro(prestacion=service, registrado_por=admin, cobrar=True,
            importe=Decimal("100"), contraparte_nombre="Synthetic responsible party")
        seleccionar_afiliacion(caso=case, usuario=admin, afiliado=affiliate, motivo="Synthetic verification")
        quote = cotizacion(caso=case, prestacion=service, fecha=today, cantidad=1)
        reservar(caso=case, prestacion=service, fecha=today, cantidad=1, usuario=admin,
            clave=uuid4(), firma=quote["firma"], acepta=True)
        event = EventoCaso.objects.create(caso=case, nodo=node, autor=admin, titulo="Synthetic completed service")
        fact = registrar_atencion_completada(case, node, event, admin)
        reservation = ReservaCobertura.objects.get(hecho=fact, prestacion=service)
        account = reservation.distribucion.obligacion_financiador
        registrar_movimiento(obligacion=account, importe=Decimal("30"), fecha=today,
            usuario=admin, clave=uuid4(), aprobado=True)
        scenarios.append({"org": org.pk, "affiliate": affiliate.pk, "service": service.pk,
            "account": account.pk, "label": f"{service.nombre} · {hospital.nombre} · {common.codigo}"})
    destination.write_text(json.dumps({"purpose": "salud-consulta-positive-e2e",
        "operator": operator.email, "password": password, "scenarios": scenarios}), encoding="utf-8")
