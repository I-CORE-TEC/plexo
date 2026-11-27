from datetime import date
from io import StringIO
from unittest.mock import patch
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.auditoria.models import AccesoClinico
from apps.casos.models import Caso
from apps.finanzas.models import Prestacion
from apps.financiadores import models as m
from apps.flujos.models import Flujo, VersionFlujo
from apps.instituciones.models import Institucion
from apps.registros.models import Ciudadano


@override_settings(
    ENTORNO="demo", SEED_DEMO=True, ALMACENAMIENTO_EN_BUCKET=True,
    STORAGES={alias: {"BACKEND": "django.core.files.storage.InMemoryStorage"}
              for alias in ("default", "facturas", "prescripciones")},
)
class DemoCleanupTests(TransactionTestCase):
    def setUp(self):
        self.user = Usuario.objects.create_user("operator@example.test", "unused")
        self.funder = m.Financiador.objects.create(nombre="Fictitious", tipo="mutual")
        other = m.Financiador.objects.create(nombre="Other", tipo="mutual")
        self.affiliate = self.create_affiliate("99001")
        self.family = self.create_affiliate("99002", titular=self.affiliate)
        self.retained = self.create_affiliate("99003")
        self.foreign = self.create_affiliate("99001", financiador=other)
        self.batch = self.create_batch(self.funder)
        self.other_batch = self.create_batch(other)
        self.history = self.create_history(self.affiliate)
        self.invoice = self.create_invoice(self.funder, "test-invoice.pdf")
        self.other_invoice = self.create_invoice(other, "other-invoice.pdf")
        hospital = Institucion.objects.create(nombre="Fictitious Hospital")
        agreement = m.Convenio.objects.create(
            institucion=hospital, financiador=self.funder, creado_por=self.user,
        )
        service = m.PrestacionComun.objects.create(codigo="TEST", nombre="Fictitious Service")
        self.request = m.SolicitudAutorizacion.objects.create(
            origen="manual", institucion=hospital, financiador=self.funder,
            convenio=agreement, afiliado=self.affiliate, comun=service,
            cantidad_solicitada=1, creado_por=self.user,
        )
        m.EventoAutorizacion.objects.create(
            solicitud=self.request, usuario=self.user, clave=uuid4(), accion="solicitar",
            estado="pendiente", revision=1, peticion={},
        )
        self.prescription = m.PrescripcionAutorizacion.objects.create(
            solicitud=self.request, ruta="test-prescription.pdf", content_type="application/pdf",
            extension=".pdf", tamano=3, sha256="b" * 64, creado_por=self.user,
        )
        storages["prescripciones"].save(self.prescription.ruta, ContentFile(b"pdf"))
        self.selectors = (
            "--afiliados-documento", "99001-99001",
            "--afiliados-documento", "99002-99002", "--importaciones", str(self.batch.pk),
            "--solicitudes", str(self.request.pk), "--adjunto-factura", self.invoice.numero,
        )

    def create_affiliate(self, document, **fields):
        return m.Afiliado.objects.create(
            numero=document, documento=document, nombre="Fictitious",
            desde=date(2026, 1, 1), **({"financiador": self.funder} | fields),
        )

    def create_batch(self, funder):
        return m.Importacion.objects.create(
            financiador=funder, clave=uuid4(), tipo="padron", creado_por=self.user,
        )

    def create_history(self, affiliate):
        return m.HistorialAfiliacion.objects.create(
            afiliado=affiliate, numero=affiliate.numero, desde=affiliate.desde,
            lote=self.batch, registrado_por=self.user,
        )

    def create_invoice(self, funder, path):
        storages["facturas"].save(path, ContentFile(b"pdf"))
        return m.RegistroFactura.objects.create(
            financiador=funder, numero="DEMO-001", direccion="recibida",
            contraparte_tipo="institucion", tipo="factura", fecha=date(2026, 1, 1),
            importe=1, clave_duplicado="a" * 64, creado_por=self.user,
            adjunto_ruta=path, adjunto_nombre=path, adjunto_content_type="application/pdf",
            adjunto_tamano=3, adjunto_sha256="a" * 64, adjunto_subido_por=self.user,
            adjunto_fecha=timezone.now(),
        )

    def cleanup(self, *args):
        output = StringIO()
        call_command("limpiar_demo", "--financiador", str(self.funder.pk), *args, stdout=output)
        return output.getvalue()

    def assert_intact(self):
        self.assertTrue(m.Afiliado.objects.filter(pk=self.affiliate.pk).exists())
        self.assertTrue(m.Importacion.objects.filter(pk=self.batch.pk).exists())
        self.assertTrue(m.SolicitudAutorizacion.objects.filter(pk=self.request.pk).exists())
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.adjunto_ruta, "test-invoice.pdf")
        self.assertTrue(storages["facturas"].exists("test-invoice.pdf"))
        self.assertTrue(storages["prescripciones"].exists("test-prescription.pdf"))
        self.assertFalse(m.EventoCobertura.objects.filter(accion="limpiar_demo").exists())

    def test_dry_run_lists_models_and_exact_bucket_keys_without_changes(self):
        output = self.cleanup(*self.selectors)
        for line in (
            "Afiliado: 2", "HistorialAfiliacion: 1", "Importacion: 1",
            "SolicitudAutorizacion: 1", "EventoAutorizacion: 1", "PrescripcionAutorizacion: 1",
            "RegistroFactura: 1", "facturas/test-invoice.pdf", "prescripciones/test-prescription.pdf",
        ):
            self.assertIn(line, output)
        self.assertNotIn("other-invoice.pdf", output)
        self.assert_intact()

    def test_apply_removes_only_the_plan_and_deletes_objects_after_commit(self):
        with transaction.atomic():
            self.cleanup(*self.selectors, "--aplicar")
            self.assertEqual(set(m.Afiliado.objects.values_list("pk", flat=True)),
                             {self.retained.pk, self.foreign.pk})
            self.assertEqual(list(m.Importacion.objects.values_list("pk", flat=True)),
                             [self.other_batch.pk])
            for model in (m.HistorialAfiliacion, m.SolicitudAutorizacion,
                          m.EventoAutorizacion, m.PrescripcionAutorizacion):
                self.assertFalse(model.objects.exists())
            self.invoice.refresh_from_db()
            self.assertEqual(
                (self.invoice.adjunto_ruta, self.invoice.adjunto_nombre,
                 self.invoice.adjunto_content_type, self.invoice.adjunto_sha256,
                 self.invoice.adjunto_tamano, self.invoice.adjunto_subido_por, self.invoice.adjunto_fecha),
                ("", "", "", "", None, None, None),
            )
            self.assertTrue(storages["facturas"].exists("test-invoice.pdf"))
            self.assertTrue(storages["prescripciones"].exists("test-prescription.pdf"))
        self.assertFalse(storages["facturas"].exists("test-invoice.pdf"))
        self.assertFalse(storages["prescripciones"].exists("test-prescription.pdf"))
        self.other_invoice.refresh_from_db()
        self.assertEqual(self.other_invoice.adjunto_ruta, "other-invoice.pdf")
        self.assertTrue(storages["facturas"].exists("other-invoice.pdf"))
        self.assertTrue(m.EventoCobertura.objects.filter(
            accion="limpiar_demo", financiador=self.funder, usuario=None,
        ).exists())

    def test_outer_rollback_keeps_database_and_objects(self):
        with transaction.atomic():
            self.cleanup(*self.selectors, "--aplicar")
            transaction.set_rollback(True)
        self.assert_intact()

    def test_production_and_disabled_seed_refuse_preview_and_apply(self):
        for settings, message in (({"ENTORNO": "produccion"}, "ENTORNO=produccion"),
                                  ({"SEED_DEMO": False}, "SEED_DEMO")):
            for flags in ((), ("--aplicar",)):
                with self.subTest(settings=settings, flags=flags), override_settings(**settings):
                    with self.assertRaisesMessage(CommandError, message):
                        self.cleanup(*self.selectors, *flags)
                    self.assert_intact()

    def test_outside_plan_dependencies_refuse_entire_operation(self):
        self.create_history(self.retained)
        self.other_invoice.afiliado = self.affiliate
        self.other_invoice.save(update_fields=["afiliado"])
        for flags in ((), ("--aplicar",)):
            with self.assertRaisesRegex(CommandError, r"(?s)RegistroFactura.*HistorialAfiliacion"):
                self.cleanup(*self.selectors, *flags)
            self.assert_intact()

    def test_clinical_access_requires_acknowledgement_and_is_never_deleted(self):
        patient = Ciudadano.objects.create(
            institucion=self.request.institucion, nombre="Fictitious", documento=self.affiliate.documento,
        )
        link = m.VinculoCiudadano.objects.create(afiliado=self.affiliate, ciudadano=patient, verificado_por=self.user)
        event = AccesoClinico.objects.create(
            usuario=self.user, tipo="detalle", recurso="historia", ciudadano=patient,
        )
        prescription_access = AccesoClinico.objects.create(
            usuario=self.user, tipo="financiador", recurso="prescripcionautorizacion", objeto_id=str(self.prescription.pk),
        )
        with self.assertRaisesMessage(CommandError, "AccesoClinico: 2"):
            self.cleanup(*self.selectors, "--aplicar")
        self.assert_intact()
        self.cleanup(*self.selectors, "--aplicar", "--permitir-accesos-clinicos")
        self.assertEqual(set(AccesoClinico.objects.values_list("pk", flat=True)), {event.pk, prescription_access.pk})
        self.assertTrue(Ciudadano.objects.filter(pk=patient.pk).exists())
        self.assertFalse(m.VinculoCiudadano.objects.filter(pk=link.pk).exists())
        self.assertFalse(m.SolicitudAutorizacion.objects.exists())

    def test_foreign_import_refuses_even_if_other_selectors_are_valid(self):
        with self.assertRaisesMessage(CommandError, "Importacion: IDs fuera del financiador"):
            self.cleanup("--importaciones", str(self.other_batch.pk), "--adjunto-factura", self.invoice.numero, "--aplicar")
        self.assert_intact()

    def test_titular_selected_without_family_refuses(self):
        document = self.affiliate.documento
        with self.assertRaisesMessage(CommandError, "Afiliado.titular"):
            self.cleanup("--afiliados-documento", f"{document}-{document}", "--aplicar")
        self.assert_intact()
        self.family.refresh_from_db()
        self.assertEqual(self.family.titular_id, self.affiliate.pk)
        self.assertTrue(m.HistorialAfiliacion.objects.filter(pk=self.history.pk).exists())

    def test_family_member_only_keeps_titular(self):
        document = self.family.documento
        self.cleanup("--afiliados-documento", f"{document}-{document}", "--aplicar")
        self.assertFalse(m.Afiliado.objects.filter(pk=self.family.pk).exists())
        self.assertTrue(m.Afiliado.objects.filter(pk=self.affiliate.pk).exists())
        self.assertTrue(m.Afiliado.objects.filter(pk=self.retained.pk).exists())

    def test_other_funder_invoice_number_not_touched(self):
        self.other_invoice.numero = "DEMO-OTHER-001"
        self.other_invoice.save(update_fields=["numero"])
        with self.assertRaisesMessage(CommandError, "RegistroFactura"):
            self.cleanup("--adjunto-factura", self.other_invoice.numero, "--aplicar")
        self.assert_intact()
        self.other_invoice.refresh_from_db()
        self.assertEqual(self.other_invoice.adjunto_ruta, "other-invoice.pdf")
        self.assertTrue(storages["facturas"].exists("other-invoice.pdf"))

    def test_other_funder_request_refused(self):
        agreement = m.Convenio.objects.create(
            institucion=self.request.institucion, financiador=self.foreign.financiador, creado_por=self.user,
        )
        request = m.SolicitudAutorizacion.objects.create(
            origen="manual", institucion=agreement.institucion, financiador=agreement.financiador,
            convenio=agreement, afiliado=self.foreign, comun=self.request.comun,
            cantidad_solicitada=1, creado_por=self.user,
        )
        with self.assertRaisesMessage(CommandError, "SolicitudAutorizacion: IDs fuera del financiador"):
            self.cleanup("--solicitudes", str(request.pk), "--aplicar")
        self.assert_intact()
        self.assertTrue(m.SolicitudAutorizacion.objects.filter(pk=request.pk).exists())

    def test_bucket_failure_reports_orphan_but_cannot_undo_commit(self):
        with patch.object(storages["facturas"], "delete", side_effect=OSError("simulated storage failure")):
            with self.assertLogs("apps.demo.archivos", level="ERROR"):
                with self.assertRaisesRegex(CommandError, r"La base confirmó.*facturas/test-invoice.pdf"):
                    self.cleanup(*self.selectors, "--aplicar")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.adjunto_ruta, "")
        self.assertTrue(storages["facturas"].exists("test-invoice.pdf"))
        self.assertFalse(storages["prescripciones"].exists("test-prescription.pdf"))

    def test_open_reservation_blocks_cleanup_but_released_use_can_be_removed(self):
        hospital = self.request.institucion
        flow = Flujo.objects.create(institucion=hospital, titulo="Fictitious")
        case = Caso.objects.create(
            institucion=hospital, version=VersionFlujo.objects.create(flujo=flow, numero=1),
        )
        affiliation = m.AfiliacionCaso.objects.create(caso=case, afiliado=self.affiliate)
        service = Prestacion.objects.create(institucion=hospital, codigo="TEST")
        reservation = m.ReservaCobertura.objects.create(
            caso=case, afiliacion=affiliation, afiliado=self.affiliate, prestacion=service,
            comun=self.request.comun, fecha=self.affiliate.desde, cantidad=1,
            evaluacion={"autorizacion": self.request.pk},
        )
        selectors = ("--solicitudes", str(self.request.pk), "--aplicar")
        with self.assertRaisesMessage(CommandError, "ReservaCobertura"):
            self.cleanup(*selectors)
        self.assert_intact()

        usage = m.UsoAutorizacion.objects.create(solicitud=self.request, reserva=reservation, cantidad=1)
        reservation.estado = "liberada"
        reservation.save(update_fields=["estado"])
        with self.assertRaisesMessage(CommandError, "ReservaCobertura"):
            self.cleanup(*selectors)
        usage.estado = "liberado"
        usage.save(update_fields=["estado"])
        self.cleanup(*selectors)
        self.assertFalse(m.UsoAutorizacion.objects.filter(pk=usage.pk).exists())
        reservation.refresh_from_db()
        self.assertEqual(reservation.evaluacion, {"autorizacion": self.request.pk})
