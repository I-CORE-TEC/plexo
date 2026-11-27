"""Drop the retired rights drafts table (#216).

The drafts were retired in #236 and no code reads them. This migration cannot
check every environment beforehand, so it carries its own data safety: before
the table is dropped, each remaining row is archived as one ``EventoCobertura``
audit record with ``accion="retirar_borrador_derechos"`` and
``objeto="BorradorReglaDerechos:<pk>"``. The record keeps the financier, the
author and a compact summary of the draft. An empty table writes nothing.

Data deletion is one-way. Reversing recreates the empty table structure only;
the audit records stay as the trace and nothing is copied back.
"""
from django.db import migrations

ACCION = "retirar_borrador_derechos"


def resumir(borrador):
    resumen = (
        f"codigo={borrador.codigo} v{borrador.version} regimen={borrador.regimen} "
        f"plan={borrador.plan_id or '-'} desde={borrador.desde} hasta={borrador.hasta or '-'} "
        f"plazo={'-' if borrador.plazo_dias_corridos is None else borrador.plazo_dias_corridos} "
        f"motivo={borrador.motivo}"
    )
    return resumen[:255]


def archivar_borradores(apps, schema_editor):
    Borrador = apps.get_model("financiadores", "BorradorReglaDerechos")
    Evento = apps.get_model("financiadores", "EventoCobertura")
    alias = schema_editor.connection.alias
    Evento.objects.using(alias).bulk_create([
        Evento(financiador_id=b.financiador_id, usuario_id=b.creado_por_id, accion=ACCION,
               objeto=f"BorradorReglaDerechos:{b.pk}", motivo=resumir(b))
        for b in Borrador.objects.using(alias).order_by("pk").iterator()
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('financiadores', '0021_prescripcion_autorizacion'),
    ]

    operations = [
        migrations.RunPython(archivar_borradores, migrations.RunPython.noop),
        migrations.DeleteModel(
            name='BorradorReglaDerechos',
        ),
    ]
