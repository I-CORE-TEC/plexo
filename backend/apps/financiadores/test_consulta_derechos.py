"""Consultas de ficha: estimaciones y saldos, nunca efectos de negocio."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.casos.models import Caso
from apps.finanzas.models import MovimientoDinero, ObligacionFinanciera
from .models import AfiliacionCaso, EventoCobertura, Financiador, ReservaCobertura
from .test_seguimiento import SeguimientoSetup


class ConsultaDerechosTests(SeguimientoSetup, APITestCase):
    def test_pagos_csv_rechaza_la_combinacion_sin_efectos(self):
        self.realizar()
        antes = self.negocio()
        respuesta = self.ficha(pagos="true", formato="csv")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(str(respuesta.data["pagos"]),
                         "La consulta de pagos solo está disponible en JSON.")
        self.assertEqual(self.negocio(), antes)

    def test_csv_sin_pagos_conserva_la_exportacion(self):
        self.realizar()
        antes = self.negocio()
        original = self.ficha(formato="csv")
        sin_pagos = self.ficha(formato="csv", pagos="false")
        self.assertEqual((original.status_code, sin_pagos.status_code), (200, 200))
        self.assertEqual(original.content, sin_pagos.content)
        self.assertNotIn(b"pago_financiador", original.content)
        self.assertEqual(self.negocio(), antes)

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.operador)
        self.base = f"/api/financiadores/{self.financiador.pk}"

    def simular(self, **cambios):
        datos = {"afiliado": self.afiliado.pk, "prestacion": self.prestacion.pk,
                 "fecha": str(self.hoy), "cantidad": 1, **cambios}
        return self.client.post(f"{self.base}/simular-prestacion/", datos, format="json")

    def ficha(self, **datos):
        return self.client.get(f"{self.base}/ficha-afiliado/",
                               {"afiliado": self.afiliado.pk, "estado": "realizada", **datos})

    def negocio(self):
        estado = [list(model.objects.order_by("pk").values()) for model in
                (Caso, AfiliacionCaso, ReservaCobertura, ObligacionFinanciera,
                 MovimientoDinero)]
        estado.append(list(EventoCobertura.objects.exclude(
            accion__in=["consultar_afiliado", "simular_prestacion", "exportar_ficha_afiliado"]
        ).order_by("pk").values()))
        return estado

    def test_simulacion_usa_reglas_y_arancel_sin_crear_atencion_ni_dinero(self):
        antes = self.negocio()
        original = self.evaluar()
        respuesta = self.simular()
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        for campo in ("importe_total", "importe_financiador", "importe_paciente", "cubiertas", "porcentaje"):
            self.assertEqual(respuesta.data[campo], original[campo])
        self.assertEqual(respuesta.data["estado"], "parcial")
        self.assertTrue(respuesta.data["simulacion"])
        self.assertNotIn("firma", respuesta.data)
        self.assertEqual(self.negocio(), antes)
        self.assertEqual(self.evaluar(), original)

    def test_afiliacion_y_fecha_no_se_omiten(self):
        for campo, valor in (("cobertura_habilitada", False),
                             ("desde", self.hoy + timedelta(days=3)),
                             ("finalizado_en", timezone.now())):
            with self.subTest(campo=campo):
                anterior = getattr(self.afiliado, campo)
                setattr(self.afiliado, campo, valor)
                self.afiliado.save(update_fields=[campo])
                r = self.simular()
                self.assertEqual(r.status_code, 200)
                self.assertEqual(r.data["estado"], "no_cubierta")
                self.assertIsNone(r.data["importe_financiador"])
                setattr(self.afiliado, campo, anterior)
                self.afiliado.save(update_fields=[campo])

    def test_cupo_y_autorizacion_no_se_presentan_como_aprobacion(self):
        self.externo(5)
        r = self.simular(cantidad=3)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["cubiertas"], 1)
        self.assertEqual(r.data["importe_financiador"], "80.00")
        self.regla.requiere_autorizacion = True
        self.regla.save(update_fields=["requiere_autorizacion"])
        r = self.simular()
        self.assertEqual(r.data["estado"], "pendiente_evaluacion")
        self.assertTrue(any(c["codigo"] == "autorizacion" and c["estado"] == "pendiente"
                            for c in r.data["comprobaciones"]))

    def test_auditor_puede_consultar_y_ajenos_son_rechazados_sin_efectos(self):
        self.membresia.rol = "auditor"
        self.membresia.save(update_fields=["rol"])
        self.assertEqual(self.simular().status_code, 200)
        otro = Financiador.objects.create(nombre="Otro", tipo="obra_social")
        antes = self.negocio()
        r = self.client.post(f"/api/financiadores/{otro.pk}/simular-prestacion/", {}, format="json")
        self.assertIn(r.status_code, (403, 404))
        self.assertEqual(self.simular(afiliado=999999).status_code, 400)
        self.assertEqual(self.simular(prestacion=999999).status_code, 400)
        self.assertEqual(self.simular(cantidad=0).status_code, 400)
        self.client.force_authenticate(Usuario.objects.create_user("sin-membresia@consulta.local", "x"))
        self.assertIn(self.simular().status_code, (403, 404))
        self.assertEqual(self.negocio(), antes)

    def test_saldos_aprobados_y_reintegros_no_sustituyen_cargos_originales(self):
        reserva = self.realizar()
        cuenta = reserva.distribucion.obligacion_financiador
        original = self.ficha().data["results"][0]
        self.assertNotIn("pago_financiador", original)
        movimiento = self.movimiento(cuenta, "30")
        antes = self.negocio()
        respuesta = self.ficha(pagos="true")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        fila = respuesta.data["results"][0]
        self.assertEqual({k: v for k, v in fila.items() if k != "pago_financiador"}, original)
        pago = fila["pago_financiador"]["cuentas"][0]
        self.assertEqual((pago["estado"], pago["registrado_neto"], pago["pendiente"]),
                         ("parcial", "30.00", "50.00"))
        self.assertNotIn("contraparte", pago)
        self.assertEqual(self.negocio(), antes)
        self.reintegro(movimiento, "10")
        pago = self.ficha(pagos="true").data["results"][0]["pago_financiador"]["cuentas"][0]
        self.assertEqual((pago["registrado_neto"], pago["pendiente"]), ("20.00", "60.00"))

    def test_saldada_por_reduccion_no_significa_pagada(self):
        cuenta = self.realizar().distribucion.obligacion_financiador
        self.reduccion(cuenta, "80")
        pago = self.ficha(pagos="true").data["results"][0]["pago_financiador"]["cuentas"][0]
        self.assertEqual((pago["estado"], pago["registrado_neto"]), ("saldada", "0.00"))

    def test_movimiento_pendiente_no_es_pago_aprobado(self):
        cuenta = self.realizar().distribucion.obligacion_financiador
        self.movimiento(cuenta, "30", aprobado=False)
        pago = self.ficha(pagos="true").data["results"][0]["pago_financiador"]["cuentas"][0]
        self.assertEqual((pago["registrado_neto"], pago["por_aprobar"], pago["pendiente"]),
                         ("0.00", "30.00", "80.00"))

    def test_pago_completo_no_amplia_acceso_historico_por_copago(self):
        reserva = self.realizar()
        self.movimiento(reserva.distribucion.obligacion_financiador, "80")
        self.afiliado.cobertura_habilitada = False
        self.afiliado.save(update_fields=["cobertura_habilitada"])
        self.assertEqual(self.ficha(pagos="true").data["results"], [])

    def test_afiliado_real_de_otro_financiador_no_es_consultable(self):
        from .services import registrar_afiliado
        otro = Financiador.objects.create(nombre="Ajeno", tipo="obra_social")
        persona = registrar_afiliado(financiador=otro, usuario=self.admin, plan=None,
                                    numero="AJENO", documento="998877", nombre="Persona ajena", desde=self.hoy)
        antes = self.negocio()
        self.assertEqual(self.simular(afiliado=persona.pk).status_code, 400)
        r = self.client.get(f"{self.base}/ficha-afiliado/", {"afiliado": persona.pk, "pagos": "true"})
        self.assertEqual(r.status_code, 404)
        self.assertEqual(self.negocio(), antes)

    def test_servicio_sin_convenio_y_limites_son_rechazados(self):
        from apps.instituciones.models import Institucion
        from apps.finanzas.models import Prestacion
        from .models import VinculoPrestacion
        hospital = Institucion.objects.create(nombre="Hospital ajeno", tipo="hospital")
        prestacion = Prestacion.objects.create(institucion=hospital, codigo="AJENA", nombre="Ajena", activo=True)
        VinculoPrestacion.objects.create(prestacion=prestacion, comun=self.comun)
        antes = self.negocio()
        self.assertEqual(self.simular(prestacion=prestacion.pk).status_code, 400)
        for cantidad in (-1, 100001):
            self.assertEqual(self.simular(cantidad=cantidad).status_code, 400)
        self.assertEqual(self.negocio(), antes)

    def test_pendientes_reintegros_y_ajustes_separados_del_copago(self):
        reserva = self.realizar()
        cuenta = reserva.distribucion.obligacion_financiador
        aprobado = self.movimiento(cuenta, "30")
        self.movimiento(cuenta, "7", aprobado=False)
        self.reintegro(aprobado, "5")
        self.reintegro(aprobado, "4", aprobado=False)
        self.reduccion(cuenta, "3")
        self.reduccion(cuenta, "6", aprobado=False)
        self.movimiento(reserva.distribucion.obligacion_paciente, "20")
        antes = self.negocio()
        cuentas = self.ficha(pagos="true").data["results"][0]["pago_financiador"]["cuentas"]
        self.assertEqual(len(cuentas), 1)
        self.assertEqual([cuentas[0][campo] for campo in
                          ("registrado_neto", "pendiente", "por_aprobar", "reintegros_por_aprobar", "ajustes_por_aprobar")],
                         ["25.00", "52.00", "7.00", "4.00", "6.00"])
        self.assertEqual(self.negocio(), antes)
        self.afiliado.cobertura_habilitada = False
        self.afiliado.save(update_fields=["cobertura_habilitada"])
        self.assertEqual(self.ficha(pagos="true").data["results"][0]["acceso"], "pendiente_historico")
