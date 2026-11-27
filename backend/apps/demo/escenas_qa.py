"""Synthetic Mutual del Valle fixtures for QA of #136 and #171."""
import hashlib
import logging
from uuid import uuid4

from django.core.files.base import ContentFile
from django.utils import timezone

from apps.demo.documentos import pdf_una_pagina
from apps.financiadores.facturas import almacenamiento_privado
from apps.financiadores.models import Financiador, Plan, RegistroFactura
from apps.financiadores.services import registrar_afiliado

logger = logging.getLogger(__name__)


def cargar_escenas_qa(al_revertir):
    mutual = Financiador.objects.get(nombre="Mutual del Valle")
    factura = RegistroFactura.objects.get(financiador=mutual, numero=f"DEMO-{mutual.pk}-001")
    afiliado = registrar_afiliado(
        financiador=mutual, usuario=factura.creado_por,
        numero="FICTICIO-QA-136", documento="99029901", nombre="FICTICIO QA Domicilio Legado",
        plan=Plan.objects.get(financiador=mutual, codigo="MV-INTEGRAL"), desde=timezone.localdate(),
    )
    # Simulate an imported historical address, not a newly matched location.
    afiliado.localidad = "Localidad de prueba"
    afiliado.partido = "Partido de prueba"
    afiliado.provincia = "Provincia de prueba"
    afiliado.save(update_fields=["localidad", "partido", "provincia"])

    # The portal seed already provides the clinical PDF in default storage.
    # Invoices use their own private storage alias and attachment metadata.
    if factura.adjunto_ruta:
        return
    contenido = pdf_una_pagina([
        (18, "Factura de prueba"),
        (11, factura.numero),
        (11, "DOCUMENTO FICTICIO DE DEMOSTRACIÓN. SIN VALIDEZ FISCAL."),
    ])
    storage = almacenamiento_privado()
    ruta = storage.save(f"{uuid4().hex}.pdf", ContentFile(contenido))
    al_revertir.callback(_limpiar_adjunto, storage, ruta)
    factura.adjunto_ruta = ruta
    factura.adjunto_nombre = "qa-factura-ficticia.pdf"
    factura.adjunto_content_type = "application/pdf"
    factura.adjunto_tamano = len(contenido)
    factura.adjunto_sha256 = hashlib.sha256(contenido).hexdigest()
    factura.adjunto_subido_por = factura.creado_por
    factura.adjunto_fecha = timezone.now()
    factura.save(update_fields=[
        "adjunto_ruta", "adjunto_nombre", "adjunto_content_type", "adjunto_tamano",
        "adjunto_sha256", "adjunto_subido_por", "adjunto_fecha", "actualizado",
    ])


def _limpiar_adjunto(storage, ruta):
    try:
        storage.delete(ruta)
    except Exception:
        logger.exception("No se pudo limpiar el adjunto ficticio tras revertir la carga.")
