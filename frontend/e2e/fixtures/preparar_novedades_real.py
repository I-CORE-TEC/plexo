"""Fixture propia y ficticia, sólo PostgreSQL loopback dedicado; no carga seeds."""
import json
import argparse
import os
from pathlib import Path
import secrets
import sys
import tempfile
from datetime import timedelta
from uuid import uuid4

if os.environ.get("DJANGO_SETTINGS_MODULE") != "config.settings_financiadores_postgres_test":
    raise RuntimeError("Esta fixture requiere settings PostgreSQL de pruebas explícitos.")

backend = Path(__file__).resolve().parents[3] / "backend"
sys.path.insert(0, str(backend))

import django
django.setup()

from django.db import connection, transaction
from django.utils import timezone
from apps.accounts.models import Usuario
from apps.financiadores.models import Afiliado, Financiador, MembresiaFinanciador
from apps.financiadores.novedades import habilitar_cobertura, registrar, resolver
from apps.financiadores.padron import editar_ficha
from apps.financiadores.services import registrar_afiliado

config = connection.settings_dict
if config["NAME"] != "salud_financiadores_test" or config["HOST"] not in {"127.0.0.1", "localhost", "::1"}:
    raise RuntimeError("Destino no admitido: se exige base ficticia exclusiva en loopback.")
parser = argparse.ArgumentParser(description="Prepara datos sintéticos locales para recorridos reales de Novedades.")
parser.add_argument("--manual", action="store_true", help="agrega una organización independiente con escenarios para aceptación manual de Derechos")
parser.add_argument("manifest", help="ruta nueva del manifiesto privado, fuera del repositorio y bajo TEMP")
args = parser.parse_args()
destino = Path(args.manifest).resolve()
if Path(tempfile.gettempdir()).resolve() not in destino.parents or destino.exists():
    raise RuntimeError("El manifiesto debe ser nuevo y estar fuera del repositorio, en temporal.")

def _preparar_fixture(destino, args):
    marca = uuid4().hex[:10]
    password = secrets.token_urlsafe(24)
    with transaction.atomic():
        operador = Usuario.objects.create_user(f"novedades-{marca}@example.invalid", password=password,
                                               nombre="Operación ficticia Novedades")
        auditor = Usuario.objects.create_user(f"novedades-lectura-{marca}@example.invalid", password=password,
                                              nombre="Auditoría ficticia Novedades")
        sin_membresia = Usuario.objects.create_user(f"derechos-sin-membresia-{marca}@example.invalid", password=password,
                                                    nombre="Sin membresía ficticia Derechos")
        organizaciones = []
        for letra in ("A", "B"):
            org = Financiador.objects.create(nombre=f"NOVEDADES FICTICIAS {letra} {marca}", tipo="obra_social")
            MembresiaFinanciador.objects.create(financiador=org, usuario=operador, rol="operador")
            MembresiaFinanciador.objects.create(financiador=org, usuario=auditor, rol="auditor")
            afiliado = registrar_afiliado(financiador=org, usuario=operador, numero="NOV-FICTICIO-1",
                documento="99018501", nombre=f"PERSONA FICTICIA {letra}", plan=None,
                desde=timezone.localdate(), cobertura_habilitada=False)
            # Escenario de presentación: un padrón futuro real no lo admite el alta pública.
            # Esta fila sintética existe sólo en la base aislada para probar clasificación vs. booleano.
            numero_futuro = f"U2-FUTURA-{marca}-{letra}"
            documento_futuro = f"99{secrets.randbelow(100_000_000):08d}"
            futuro = Afiliado.objects.create(financiador=org, numero=numero_futuro,
                documento=documento_futuro, nombre=f"PERSONA FUTURA SINTÉTICA {letra}",
                plan=None, desde=timezone.localdate() + timedelta(days=30), cobertura_habilitada=True)
            novedad_legacy, _ = registrar(financiador=org, usuario=operador, clave=uuid4(),
                afiliado=afiliado.pk, fuente="Fixture histórica ficticia",
                referencia=f"LEGACY-{letra}-{marca}", codigo="LEGACY",
                fecha_informada=None, descripcion="Snapshot histórico sintético sin campo de cobertura",
                motivo="Preparación aislada del estado histórico", rectifica=None)
            novedad_legacy.filas[0]["persona_inicial"].pop("cobertura_habilitada", None)
            novedad_legacy.save(update_fields=["filas"])
            organizaciones.append({"id": org.pk, "nombre": org.nombre,
                                    "afiliado": afiliado.pk, "documento": afiliado.documento,
                                    "afiliado_futuro": futuro.pk, "documento_futuro": futuro.documento,
                                    "legacy_novedad": novedad_legacy.pk})
        manifiesto = {"purpose": "salud-novedades-e2e", "password": password,
            "operador": operador.email, "auditor": auditor.email, "sin_membresia": sin_membresia.email,
            "organizaciones": organizaciones}
        if args.manual:
            manifiesto["manual"] = _crear_datos_manuales(marca)
        destino.write_text(json.dumps(manifiesto), encoding="utf-8")


def _crear_datos_manuales(marca):
    password_manual = secrets.token_urlsafe(24)
    operador_manual = Usuario.objects.create_user(
        f"derechos-operador-{marca}@example.invalid", password=password_manual,
        nombre="Operador ficticio Derechos",
    )
    auditor_manual = Usuario.objects.create_user(
        f"derechos-auditor-{marca}@example.invalid", password=password_manual,
        nombre="Auditor ficticio Derechos",
    )
    organizaciones_manuales = []
    for sufijo in ("A", "B"):
        org = Financiador.objects.create(nombre=f"DERECHOS MANUAL FICTICIO {sufijo} {marca}", tipo="obra_social")
        MembresiaFinanciador.objects.create(financiador=org, usuario=operador_manual, rol="operador")
        MembresiaFinanciador.objects.create(financiador=org, usuario=auditor_manual, rol="auditor")

        def afiliado(nombre, cobertura=False, desde=None):
            identificador = uuid4().hex[:12]
            return registrar_afiliado(
                financiador=org, usuario=operador_manual, numero=f"MAN-{sufijo}-{identificador}",
                documento=f"98{secrets.randbelow(100_000_000):08d}", nombre=nombre,
                plan=None, desde=desde or timezone.localdate(), cobertura_habilitada=cobertura,
                motivo="Preparación de escenario sintético manual.",
            )

        def novedad(persona, nombre):
            return registrar(
                financiador=org, usuario=operador_manual, clave=uuid4(), afiliado=persona.pk,
                fuente="Carga sintética para aceptación manual", referencia=f"MAN-{sufijo}-{nombre}-{uuid4().hex[:8]}",
                codigo=f"MAN-{nombre.upper()}", fecha_informada=None,
                descripcion=f"Evidencia ficticia del escenario {nombre}.",
                motivo="Preparación de evidencia sintética; no aplica efectos automáticos.", rectifica=None,
            )[0]

        def conciliar(propuesta):
            snapshot = propuesta.filas[0]
            return resolver(
                financiador=org, usuario=operador_manual, novedad_id=propuesta.pk,
                accion="conciliar", motivo="Revisión manual sintética; sin aplicar efectos.",
                revision=snapshot["revision"], revision_padron=snapshot["persona_inicial"]["revision"],
                confirmar_conflictos=False,
            )

        def habilitar(propuesta, persona, valor):
            actual = Afiliado.objects.get(pk=persona.pk)
            return habilitar_cobertura(
                financiador=org, usuario=operador_manual, novedad_id=propuesta.pk,
                revision=propuesta.filas[0]["revision"], revision_padron=actual.revision,
                cobertura_habilitada=valor,
                motivo="Decisión explícita para aceptación manual; sólo cobertura_habilitada.",
            )

        persona_decision = afiliado(f"PERSONA MANUAL {sufijo} DECISION", cobertura=False)
        novedad_decision = novedad(persona_decision, "decision")

        persona_aplicada = afiliado(f"PERSONA MANUAL {sufijo} APLICADA", cobertura=False)
        novedad_aplicada = novedad(persona_aplicada, "aplicada")
        novedad_aplicada = conciliar(novedad_aplicada)
        novedad_aplicada = habilitar(novedad_aplicada, persona_aplicada, True)

        persona_sin_cambios = afiliado(f"PERSONA MANUAL {sufijo} SIN CAMBIOS", cobertura=True)
        novedad_sin_cambios = conciliar(novedad(persona_sin_cambios, "sin-cambios"))
        novedad_sin_cambios = habilitar(novedad_sin_cambios, persona_sin_cambios, True)

        persona_conflicto = afiliado(f"PERSONA MANUAL {sufijo} CONFLICTO", cobertura=False)
        novedad_conflicto = novedad(persona_conflicto, "conflicto")
        editar_ficha(
            afiliado=persona_conflicto, usuario=operador_manual,
            entrada={"revision": persona_conflicto.revision,
                     "motivo": "Crear conflicto sintético de revisión.",
                     "nombre": f"PERSONA MANUAL {sufijo} CONFLICTO ACTUALIZADA"},
        )

        documento_futuro = f"97{secrets.randbelow(100_000_000):08d}"
        futura = Afiliado.objects.create(
            financiador=org, numero=f"MAN-FUTURA-{sufijo}-{marca}", documento=documento_futuro,
            nombre=f"PERSONA MANUAL {sufijo} FUTURA", plan=None,
            desde=timezone.localdate() + timedelta(days=30), cobertura_habilitada=True,
        )
        persona_finalizada = afiliado(f"PERSONA MANUAL {sufijo} FINALIZADA", cobertura=True)
        from apps.financiadores.vigencias import finalizar_afiliacion
        persona_finalizada = finalizar_afiliacion(
            usuario=operador_manual, afiliado=persona_finalizada,
            motivo="Preparación de escenario sintético manual.",
        )

        persona_historica = afiliado(f"PERSONA MANUAL {sufijo} HISTORICA", cobertura=False)
        novedad_historica = novedad(persona_historica, "historica")
        novedad_historica.filas[0]["persona_inicial"].pop("cobertura_habilitada", None)
        novedad_historica.save(update_fields=["filas"])

        def persona_manifest(persona):
            return {"id": persona.pk, "documento": persona.documento}

        organizaciones_manuales.append({
            "id": org.pk, "nombre": org.nombre,
            "escenarios": {
                "decision": {"afiliado": persona_manifest(persona_decision), "novedad": novedad_decision.pk},
                "aplicada": {"afiliado": persona_manifest(persona_aplicada), "novedad": novedad_aplicada.pk,
                             "historial": novedad_aplicada.filas[0]["habilitacion_cobertura"]["historial_id"]},
                "sin_cambios": {"afiliado": persona_manifest(persona_sin_cambios), "novedad": novedad_sin_cambios.pk},
                "conflicto": {"afiliado": persona_manifest(persona_conflicto), "novedad": novedad_conflicto.pk},
                "futura": persona_manifest(futura),
                "finalizada": persona_manifest(persona_finalizada),
                "historica": {"afiliado": persona_manifest(persona_historica), "novedad": novedad_historica.pk},
            },
        })
    return {"operador": operador_manual.email, "auditor": auditor_manual.email,
            "password": password_manual, "organizaciones": organizaciones_manuales}


_preparar_fixture(destino, args)
