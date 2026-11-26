"""Single coverage decision (#216 S1-S3) and the sites aligned to it (S2)."""
from datetime import timedelta
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.casos.models import Caso
from . import autorizaciones as a, models as m
from .cobertura import seleccionar_afiliacion
from .preparacion import verificar_preparacion
from .serializers import AfiliadoSerializer
from .test_autorizaciones_manuales import ManualSetup
from .vigencias import afiliados_vigentes, q_cobertura, tiene_cobertura


class TieneCoberturaTests(TestCase):
    def setUp(self):
        self.hoy = timezone.localdate()
        self.financiador = m.Financiador.objects.create(nombre="Obra social", tipo="obra_social")
        self.usuario = Usuario.objects.create_user("registro@cobertura.local", "x")

    def afiliado(self, numero, **datos):
        valores = dict(financiador=self.financiador, numero=numero, documento=numero, nombre="Ana", desde=self.hoy)
        valores.update(datos)
        return m.Afiliado.objects.create(**valores)

    def casos(self):
        inactivo = m.Financiador.objects.create(nombre="Inactivo", tipo="mutual", activo=False)
        return {
            "vigente": self.afiliado("1"),
            "sin_cobertura": self.afiliado("2", cobertura_habilitada=False),
            "finalizada": self.afiliado("3", finalizado_en=timezone.now()),
            "futura": self.afiliado("4", desde=self.hoy + timedelta(days=1)),
            "financiador_inactivo": self.afiliado("5", financiador=inactivo),
        }

    def test_un_motivo_por_cada_estado(self):
        for motivo, afiliado in self.casos().items():
            with self.subTest(motivo=motivo):
                self.assertEqual(tiene_cobertura(afiliado), (motivo == "vigente", motivo))

    def test_limite_de_inicio_de_vigencia(self):
        afiliado = self.afiliado("1", desde=self.hoy)
        self.assertEqual(tiene_cobertura(afiliado, self.hoy), (True, "vigente"))
        self.assertEqual(tiene_cobertura(afiliado, self.hoy - timedelta(days=1)), (False, "futura"))
        manana = self.afiliado("2", desde=self.hoy + timedelta(days=1))
        self.assertEqual(tiene_cobertura(manana, self.hoy), (False, "futura"))
        self.assertEqual(tiene_cobertura(manana, self.hoy + timedelta(days=1)), (True, "vigente"))

    def test_precedencia_de_motivos(self):
        inactivo = m.Financiador.objects.create(nombre="Otro", tipo="mutual", activo=False)
        todo = self.afiliado("1", financiador=inactivo, cobertura_habilitada=False,
                             finalizado_en=timezone.now(), desde=self.hoy + timedelta(days=1))
        self.assertEqual(tiene_cobertura(todo)[1], "sin_cobertura")
        todo.cobertura_habilitada = True
        self.assertEqual(tiene_cobertura(todo)[1], "finalizada")
        todo.finalizado_en = None
        self.assertEqual(tiene_cobertura(todo)[1], "futura")
        todo.desde = self.hoy
        self.assertEqual(tiene_cobertura(todo)[1], "financiador_inactivo")

    def test_q_cobertura_coincide_con_tiene_cobertura(self):
        casos = self.casos()
        for fecha in (self.hoy, self.hoy + timedelta(days=1)):
            for motivo, afiliado in casos.items():
                with self.subTest(motivo=motivo, fecha=fecha):
                    esperado = tiene_cobertura(afiliado, fecha)[0]
                    self.assertEqual(m.Afiliado.objects.filter(q_cobertura(fecha), pk=afiliado.pk).exists(), esperado)
                    historial = m.HistorialAfiliacion.objects.create(
                        afiliado=afiliado, numero=afiliado.numero, desde=afiliado.desde, registrado_por=self.usuario)
                    self.assertEqual(m.HistorialAfiliacion.objects.filter(
                        q_cobertura(fecha, prefijo="afiliado__"), pk=historial.pk).exists(), esperado)

    def test_afiliados_vigentes_usa_la_regla_comun(self):
        casos = self.casos()
        self.assertEqual(list(afiliados_vigentes().values_list("pk", flat=True)), [casos["vigente"].pk])


class SitiosAlineadosTests(ManualSetup, APITestCase):
    """S2: the previously permissive sites now apply the full rule."""

    def inactivar_financiador(self):
        m.Financiador.objects.filter(pk=self.financiador.pk).update(activo=False)
        self.afiliado.refresh_from_db()

    def test_indicador_vigente_del_padron_exige_financiador_activo(self):
        self.assertTrue(AfiliadoSerializer(self.afiliado).data["vigente"])
        self.inactivar_financiador()
        self.assertFalse(AfiliadoSerializer(m.Afiliado.objects.get(pk=self.afiliado.pk)).data["vigente"])

    def test_preparacion_no_cuenta_padron_de_financiador_inactivo(self):
        informe = verificar_preparacion(institucion_id=self.institucion.pk, financiadores=[self.financiador.pk])
        self.assertEqual(informe["totales"]["afiliaciones_vigentes"], 1)
        self.inactivar_financiador()
        informe = verificar_preparacion(institucion_id=self.institucion.pk, financiadores=[self.financiador.pk])
        self.assertEqual(informe["totales"]["afiliaciones_vigentes"], 0)
        self.assertIn("padron_sin_vigentes", {h["codigo"] for h in informe["hallazgos"]})

    def test_bandeja_del_financiador_oculta_terminadas_si_el_financiador_esta_inactivo(self):
        obj = self.manual()
        a.resolver(solicitud=obj, usuario=self.operador, revision=1, decision="rechazar", motivo="Incompleta", clave=uuid4())
        self.assertTrue(a.solicitudes_visibles_financiador(self.financiador.pk).filter(pk=obj.pk).exists())
        self.inactivar_financiador()
        self.assertFalse(a.solicitudes_visibles_financiador(self.financiador.pk).filter(pk=obj.pk).exists())

    def observada(self):
        obj = self.manual()
        a.resolver(solicitud=obj, usuario=self.operador, revision=1, decision="observar", motivo="Aclarar", clave=uuid4())
        return obj

    def puede_reenviar(self, obj):
        self.client.force_authenticate(self.operador)
        respuesta = self.client.get(self.url, {"financiador": self.financiador.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return next(f["puede_reenviar"] for f in respuesta.data["results"] if f["id"] == obj.pk)

    def test_puede_reenviar_exige_vigencia_iniciada(self):
        obj = self.observada()
        self.assertTrue(self.puede_reenviar(obj))
        m.Afiliado.objects.filter(pk=self.afiliado.pk).update(desde=self.hoy + timedelta(days=1))
        self.assertFalse(self.puede_reenviar(obj))

    def test_reenviar_rechaza_vigencia_futura(self):
        obj = self.observada()
        m.Afiliado.objects.filter(pk=self.afiliado.pk).update(desde=self.hoy + timedelta(days=1))
        obj.refresh_from_db()
        with self.assertRaisesMessage(ValidationError, "La afiliación o el convenio cerraron. No se abre una nueva evaluación."):
            a.reenviar(solicitud=obj, usuario=self.operador, revision=2, justificacion="Aclaración", clave=uuid4())


class RegresionesVerificadorTests(ManualSetup, APITestCase):
    """Verifier probes: hospital re-send path, request context and padrón query count."""

    def observada_del_caso(self):
        obj = self.solicitud()
        a.resolver(solicitud=obj, usuario=self.operador, revision=1, decision="observar", motivo="Precisar orden", clave=uuid4())
        obj.refresh_from_db()
        return obj

    def puede_reenviar_hospital(self, obj):
        self.client.force_authenticate(self.usuario)
        respuesta = self.client.get(self.url, {"institucion": self.institucion.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return next(f["puede_reenviar"] for f in respuesta.data["results"] if f["id"] == obj.pk)

    def assert_reenvio_hospital_bloqueado(self, cambio):
        obj = self.observada_del_caso()
        self.assertTrue(self.puede_reenviar_hospital(obj))
        cambio()
        self.assertFalse(self.puede_reenviar_hospital(obj))
        obj = m.SolicitudAutorizacion.objects.get(pk=obj.pk)
        with self.assertRaisesMessage(ValidationError, "La afiliación o el convenio cerraron. No se abre una nueva evaluación."):
            a.reenviar(solicitud=obj, usuario=self.usuario, revision=2, justificacion="Orden aclarada", clave=uuid4())

    def test_reenvio_del_hospital_exige_financiador_activo(self):
        self.assert_reenvio_hospital_bloqueado(
            lambda: m.Financiador.objects.filter(pk=self.financiador.pk).update(activo=False))

    def test_reenvio_del_hospital_exige_vigencia_iniciada(self):
        self.assert_reenvio_hospital_bloqueado(
            lambda: m.Afiliado.objects.filter(pk=self.afiliado.pk).update(desde=self.hoy + timedelta(days=1)))

    def test_contexto_no_permite_solicitar_con_financiador_inactivo(self):
        self.client.force_authenticate(self.usuario)
        self.assertTrue(self.client.get(self.url + "contexto/", {"caso": self.caso.pk}).data["puede_solicitar"])
        m.Financiador.objects.filter(pk=self.financiador.pk).update(activo=False)
        respuesta = self.client.get(self.url + "contexto/", {"caso": self.caso.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertFalse(respuesta.data["puede_solicitar"])

    def consultas_padron(self):
        self.client.force_authenticate(self.operador)
        with CaptureQueriesContext(connection) as consultas:
            respuesta = self.client.get(f"/api/financiadores/{self.financiador.pk}/padron/", {"estado": "todos"})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data["count"], len(consultas)

    def test_padron_no_consulta_el_financiador_por_fila(self):
        m.Afiliado.objects.create(financiador=self.financiador, numero="00002", documento="2", nombre="Dos", desde=self.hoy)
        filas, chico = self.consultas_padron()
        self.assertEqual(filas, 2)
        for numero in range(3, 7):
            m.Afiliado.objects.create(financiador=self.financiador, numero=f"0000{numero}", documento=str(numero),
                                      nombre="Otro", desde=self.hoy)
        filas, grande = self.consultas_padron()
        self.assertEqual(filas, 6)
        self.assertEqual(grande, chico)


class SeleccionConservaMensajesTests(ManualSetup, TestCase):
    """cobertura.py keeps its per-cause messages, now mapped from `motivo`."""

    def seleccionar(self):
        caso = Caso.objects.get(pk=self.caso.pk)
        return seleccionar_afiliacion(caso=caso, usuario=self.admin, afiliado=self.afiliado, motivo="Otra verificación")

    def test_registro_administrativo(self):
        m.Afiliado.objects.filter(pk=self.afiliado.pk).update(cobertura_habilitada=False)
        with self.assertRaisesMessage(ValidationError, "El registro es sólo administrativo."):
            self.seleccionar()

    def test_no_vigente_por_cada_causa(self):
        for cambios in ({"finalizado_en": timezone.now()}, {"desde": self.hoy + timedelta(days=1)}):
            with self.subTest(cambios=cambios):
                m.Afiliado.objects.filter(pk=self.afiliado.pk).update(**{"finalizado_en": None, "desde": self.hoy, **cambios})
                with self.assertRaisesMessage(ValidationError, "La afiliación no está vigente para una nueva selección."):
                    self.seleccionar()
        m.Afiliado.objects.filter(pk=self.afiliado.pk).update(finalizado_en=None, desde=self.hoy)
        m.Financiador.objects.filter(pk=self.financiador.pk).update(activo=False)
        with self.assertRaisesMessage(ValidationError, "La afiliación no está vigente para una nueva selección."):
            self.seleccionar()
