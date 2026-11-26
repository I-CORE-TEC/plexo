"""#219: padrón OSTEL mensual agrupado en altas, modificaciones, bajas, reingresos y conflictos.

Datos inventados y base de pruebas aislada. Cada regla del lote se prueba por la API pública.
"""
from datetime import date, datetime, time, timedelta
from unittest import mock
from uuid import uuid4

from django.core.exceptions import ValidationError

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Usuario
from .models import Afiliado, Financiador, HistorialAfiliacion, Importacion, MembresiaFinanciador, Plan
from .ostel_importacion import CONTRATO
from .ostel_synthetic import Lote, _cuil, _persona, generar_xlsx

MOTIVO = "Padrón OSTEL de noviembre"


def fila(indice, **cambios):
    return _persona(indice, NUMERO=f"{indice:06d}", **cambios)


class PadronMensualGruposTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Financiador.objects.create(nombre="Mensual ficticia", tipo="obra_social")
        cls.user = Usuario.objects.create_user("mensual-ostel@example.invalid", nombre="Operador ficticio")
        MembresiaFinanciador.objects.create(financiador=cls.org, usuario=cls.user, rol="operador")
        cls.plan = Plan.objects.create(financiador=cls.org, codigo="PLAN-A", nombre="Plan ficticio A")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.base = f"/api/financiadores/{self.org.pk}/"

    # Helpers ---------------------------------------------------------------
    def existente(self, indice, **campos):
        documento = str(99018500 + indice)
        valores = dict(financiador=self.org, numero=f"FIC185-{indice:04d}-AAA", numero_interno=f"{indice:06d}",
                       documento=documento, cuil=_cuil(documento), nombre=f"PERSONA FICTICIA OSTEL {indice:04d}",
                       desde=date(2025, 1, 1), plan=self.plan, cobertura_habilitada=False)
        valores.update(campos)
        return Afiliado.objects.create(**valores)

    def finalizado(self, indice, **campos):
        obj = self.existente(indice, **campos)
        # Baja anterior fija (01/07/2026), antes del FECING 01/08/2026 de los reingresos.
        obj.finalizado_en = timezone.make_aware(datetime(2026, 7, 1, 12, 0))
        obj.motivo_finalizacion = "Cierre ficticio anterior"
        obj.save(update_fields=["finalizado_en", "motivo_finalizacion"])
        return obj

    def preview(self, filas, fuente="base"):
        r = self.client.post(self.base + "previsualizar-ostel/", {
            "archivo": SimpleUploadedFile("mensual.xlsx", generar_xlsx(Lote("mensual", tuple(filas)))),
            "clave": str(uuid4()), "fuente": fuente, "cobertura_habilitada": False,
        }, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def aplicar(self, lote, grupos, motivo=MOTIVO, **extra):
        return self.client.post(self.base + "aplicar-ostel/", {
            "importacion": lote["id"], "grupos": grupos, "motivo": motivo, **extra}, format="json")

    def unica(self, lote):
        self.assertEqual(len(lote["filas"]), 1)
        return lote["filas"][0]

    def assert_conflicto(self, lote, mensaje):
        f = self.unica(lote)
        self.assertEqual((f["estado"], f["grupo"]), ("revision", "conflicto"))
        self.assertIn(mensaje, f["errores"])
        self.assertEqual(lote["resumen"]["grupos"]["conflicto"], 1)

    def huella(self):
        return (list(Afiliado.objects.order_by("pk").values()), list(HistorialAfiliacion.objects.order_by("pk").values()))

    # S1: clasificación ------------------------------------------------------
    def test_lote_nuevo_declara_contrato_y_cuenta_los_cinco_grupos(self):
        self.existente(2, nombre="NOMBRE ANTERIOR")
        self.existente(3)
        self.finalizado(4)
        lote = self.preview([fila(1), fila(2), fila(3, FECBAJ=date(2026, 6, 30)),
                             fila(4, FECING=date(2026, 8, 1)), fila(5, CUIL="123")])
        self.assertEqual(lote["version"], 3)
        self.assertEqual(lote["resumen"]["contrato"], CONTRATO)
        self.assertEqual(lote["resumen"]["grupos"],
                         {"alta": 1, "modificacion": 1, "baja": 1, "reingreso": 1, "conflicto": 1})
        self.assertEqual(lote["resumen"]["pendientes"], {"alta": 1, "modificacion": 1, "baja": 1, "reingreso": 1})
        self.assertEqual([f["grupo"] for f in lote["filas"]], ["alta", "modificacion", "baja", "reingreso", "conflicto"])

    def test_alta_documento_nuevo_sin_baja(self):
        f = self.unica(self.preview([fila(1)]))
        self.assertEqual((f["estado"], f["grupo"], f["diferencias"]), ("valida", "alta", []))

    def test_modificacion_muestra_antes_y_despues_sin_motivo_por_fila(self):
        self.existente(1, nombre="NOMBRE ANTERIOR", calle="CALLE VIEJA")
        f = self.unica(self.preview([fila(1, A_CALLE="CALLE NUEVA")]))
        self.assertEqual((f["estado"], f["grupo"]), ("valida", "modificacion"))
        self.assertIn({"campo": "nombre", "anterior": "NOMBRE ANTERIOR", "nuevo": "PERSONA FICTICIA OSTEL 0001"},
                      f["diferencias"])
        self.assertIn({"campo": "calle", "anterior": "CALLE VIEJA", "nuevo": "CALLE NUEVA"}, f["diferencias"])

    def test_modificacion_sin_cambios_tiene_diferencias_vacias(self):
        obj = self.existente(1)
        obj.calle, obj.altura, obj.codigo_postal, obj.localidad = "CALLE FICTICIA", "001", "0000", "LOCALIDAD FICTICIA"
        obj.email, obj.fecha_nacimiento = "ostel-1@example.invalid", date(1990, 1, 1)
        obj.save()
        f = self.unica(self.preview([fila(1)]))
        self.assertEqual((f["estado"], f["grupo"], f["diferencias"]), ("valida", "modificacion", []))

    def test_baja_por_fecbaj_estado_b_o_fuente_bajas_guarda_fecha(self):
        for n, cambios, fuente in ((1, {"FECBAJ": date(2026, 6, 30)}, "base"),
                                   (2, {"FECBAJ": date(2026, 6, 30), "ESTADO": "B"}, "base"),
                                   (3, {"FECBAJ": date(2026, 6, 30)}, "bajas")):
            with self.subTest(fuente=fuente, cambios=cambios):
                self.existente(n)
                f = self.unica(self.preview([fila(n, **cambios)], fuente=fuente))
                self.assertEqual((f["estado"], f["grupo"], f["fecha_baja"]), ("valida", "baja", "2026-06-30"))

    def test_fecvto_nunca_genera_baja(self):
        self.existente(1)
        f = self.unica(self.preview([fila(1, FECVTO=date(2025, 1, 31))]))
        self.assertEqual((f["estado"], f["grupo"], f["fecha_baja"]), ("valida", "modificacion", None))

    def test_reingreso_de_finalizado_guarda_fecing_y_plan_anterior(self):
        self.finalizado(1)
        f = self.unica(self.preview([fila(1, FECING=date(2026, 8, 1))]))
        self.assertEqual((f["estado"], f["grupo"], f["fecha_ingreso"], f["plan_anterior"]),
                         ("valida", "reingreso", "2026-08-01", self.plan.pk))

    # S1: conflictos ---------------------------------------------------------
    def test_conflictos_de_fechas_y_estados(self):
        futura = timezone.localdate() + timedelta(days=30)
        inactivo = Plan.objects.create(financiador=self.org, codigo="PLAN-I", nombre="Inactivo", activo=False)
        casos = (
            ("baja anterior al ingreso", lambda: self.existente(1), fila(1, FECBAJ=date(2025, 12, 31)),
             "FECBAJ es anterior a FECING. Revisá las fechas en el archivo."),
            ("baja futura", lambda: self.existente(2), fila(2, FECBAJ=futura),
             "FECBAJ es una fecha futura. La baja se carga cuando ocurra."),
            ("estado B sin fecha", lambda: self.existente(3), fila(3, ESTADO="B"),
             "ESTADO indica baja pero falta FECBAJ."),
            ("baja sin padrón", lambda: None, fila(4, FECBAJ=date(2026, 6, 30)),
             "Baja de un documento que no está en el padrón."),
            ("baja ya finalizada", lambda: self.finalizado(5), fila(5, FECBAJ=date(2026, 6, 30)),
             "La afiliación ya está finalizada. La baja no se repite."),
            ("reingreso sin plan", lambda: self.finalizado(6, plan=None), fila(6, FECING=date(2026, 8, 1)),
             "Reingreso sin plan anterior activo. Reactivá la afiliación manualmente."),
            ("reingreso plan inactivo", lambda: self.finalizado(7, plan=inactivo), fila(7, FECING=date(2026, 8, 1)),
             "Reingreso sin plan anterior activo. Reactivá la afiliación manualmente."),
            ("reingreso sin FECING", lambda: self.finalizado(8), fila(8, FECING=None),
             "Reingreso sin FECING válida."),
            ("reingreso FECING futura", lambda: self.finalizado(9), fila(9, FECING=futura),
             "Reingreso con FECING futura."),
        )
        for nombre, preparar, persona, mensaje in casos:
            with self.subTest(nombre):
                preparar()
                lote = self.preview([persona])
                self.assert_conflicto(lote, mensaje)
                antes = self.huella()
                r = self.aplicar(lote, ["alta", "modificacion", "baja", "reingreso"], confirmar_bajas=True)
                self.assertEqual(r.status_code, 200, r.data)
                self.assertEqual(r.data["resumen"]["aplicada"], 0)
                self.assertEqual(self.huella(), antes)

    def test_baja_anterior_al_inicio_de_la_afiliacion_es_conflicto(self):
        obj = self.existente(1, desde=date(2026, 7, 1))
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        self.assert_conflicto(lote, "FECBAJ es anterior al inicio de la afiliación en el padrón.")
        self.assertEqual(lote["filas"][0]["columnas_error"], ["FECBAJ"])
        r = self.aplicar(lote, ["baja"], confirmar_bajas=True)
        self.assertEqual((r.status_code, r.data["resumen"]["aplicada"]), (200, 0))
        obj.refresh_from_db()
        self.assertIsNone(obj.finalizado_en)

    def test_reingreso_con_fecing_no_posterior_a_la_baja_es_conflicto(self):
        obj = self.finalizado(1)
        for fecing in (date(2026, 7, 1), date(2026, 6, 1)):
            with self.subTest(fecing=fecing):
                lote = self.preview([fila(1, FECING=fecing)])
                self.assert_conflicto(lote, "FECING no es posterior a la baja anterior.")
                self.assertEqual(lote["filas"][0]["columnas_error"], ["FECING"])
                r = self.aplicar(lote, ["reingreso"])
                self.assertEqual((r.status_code, r.data["resumen"]["aplicada"]), (200, 0))
                obj.refresh_from_db()
                self.assertIsNotNone(obj.finalizado_en)

    def test_fechas_inconsistentes_se_revalidan_al_aplicar(self):
        baja = self.existente(1)
        reingreso = self.finalizado(2)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30)), fila(2, FECING=date(2026, 8, 1))])
        self.assertEqual([f["grupo"] for f in lote["filas"]], ["baja", "reingreso"])
        # Cambios posteriores a la vista previa sin pasar por la revisión del padrón.
        Afiliado.objects.filter(pk=baja.pk).update(desde=date(2026, 7, 1))
        Afiliado.objects.filter(pk=reingreso.pk).update(finalizado_en=timezone.make_aware(datetime(2026, 8, 15, 12)))
        r = self.aplicar(lote, ["baja", "reingreso"], confirmar_bajas=True)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([f["grupo"] for f in r.data["filas"]], ["conflicto", "conflicto"])
        self.assertIn("FECBAJ es anterior al inicio de la afiliación en el padrón.", r.data["filas"][0]["errores"])
        self.assertIn("FECING no es posterior a la baja anterior.", r.data["filas"][1]["errores"])
        baja.refresh_from_db()
        reingreso.refresh_from_db()
        self.assertIsNone(baja.finalizado_en)
        self.assertIsNotNone(reingreso.finalizado_en)

    def test_conflicto_de_identidad_conserva_mensaje(self):
        lote = self.preview([fila(1, CUIL=_cuil("99018502"))])
        self.assert_conflicto(lote, "Documento y CUIL no concuerdan; requiere revisión humana.")

    def test_conflicto_de_cobertura_queda_en_conflictos(self):
        self.existente(1, cobertura_habilitada=True)
        lote = self.preview([fila(1)])
        f = self.unica(lote)
        self.assertEqual((f["estado"], f["grupo"]), ("revision", "conflicto"))
        self.assertTrue(f["conflicto_cobertura"])

    def test_original_conserva_las_40_columnas(self):
        self.existente(1)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        guardada = Importacion.objects.get(pk=lote["id"]).filas[0]["original"]
        self.assertEqual(len(guardada), 40)
        self.assertEqual((guardada["FECBAJ"], guardada["FECVTO"]), ("2026-06-30T00:00:00", "2026-12-31T00:00:00"))

    # S2: aplicar por grupo --------------------------------------------------
    def test_alta_aplicada_con_motivo_del_lote(self):
        lote = self.preview([fila(1)])
        r = self.aplicar(lote, ["alta"])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["resumen"]["aplicada"], 1)
        self.assertEqual(r.data["filas"][0]["grupo"], "alta")
        obj = Afiliado.objects.get(documento="99018501")
        self.assertEqual((obj.numero_interno, obj.desde, obj.finalizado_en), ("000001", timezone.localdate(), None))
        historial = HistorialAfiliacion.objects.filter(afiliado=obj)
        self.assertTrue(historial.exists())
        self.assertTrue(all(h.motivo == MOTIVO and h.origen == "importacion" and h.lote_id == lote["id"]
                            for h in historial))

    def test_modificacion_aplicada_registra_historial_con_motivo_del_lote(self):
        obj = self.existente(1, nombre="NOMBRE ANTERIOR", calle="CALLE VIEJA")
        lote = self.preview([fila(1, A_CALLE="CALLE NUEVA")])
        r = self.aplicar(lote, ["modificacion"])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["resumen"]["aplicada"], 1)
        obj.refresh_from_db()
        self.assertEqual((obj.nombre, obj.calle), ("PERSONA FICTICIA OSTEL 0001", "CALLE NUEVA"))
        h = HistorialAfiliacion.objects.filter(afiliado=obj, origen="importacion").last()
        self.assertEqual((h.motivo, h.lote_id), (MOTIVO, lote["id"]))
        self.assertEqual(h.cambios["calle"], {"anterior": "CALLE VIEJA", "nuevo": "CALLE NUEVA"})

    def test_bajas_requieren_confirmacion_explicita(self):
        obj = self.existente(1)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        for extra in ({}, {"confirmar_bajas": False}):
            with self.subTest(extra=extra):
                r = self.aplicar(lote, ["baja"], **extra)
                self.assertEqual(r.status_code, 400, r.data)
                self.assertIn("Confirmá explícitamente las bajas del lote.", str(r.data))
        obj.refresh_from_db()
        self.assertIsNone(obj.finalizado_en)
        self.assertEqual(Importacion.objects.get(pk=lote["id"]).filas[0]["estado"], "valida")

    def test_baja_aplicada_finaliza_al_cierre_del_dia_de_fecbaj(self):
        obj = self.existente(1)
        revision = obj.revision
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30), FECVTO=date(2026, 12, 31))])
        r = self.aplicar(lote, ["baja"], confirmar_bajas=True)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["resumen"]["aplicada"], r.data["filas"][0]["estado"]), (1, "aplicada"))
        obj.refresh_from_db()
        self.assertEqual(obj.finalizado_en, timezone.make_aware(datetime.combine(date(2026, 6, 30), time(23, 59, 59))))
        self.assertEqual((obj.motivo_finalizacion, obj.finalizado_por_id), (MOTIVO, self.user.pk))
        self.assertEqual(obj.revision, revision + 1)
        h = HistorialAfiliacion.objects.get(afiliado=obj)
        self.assertEqual((h.tipo, h.desde, h.motivo, h.origen, h.lote_id),
                         ("finalizacion", date(2026, 6, 30), MOTIVO, "importacion", lote["id"]))

    def test_reingreso_reactiva_con_plan_anterior_desde_fecing_y_actualiza_ficha(self):
        obj = self.finalizado(1, nombre="NOMBRE ANTERIOR")
        lote = self.preview([fila(1, FECING=date(2026, 8, 1))])
        r = self.aplicar(lote, ["reingreso"])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["resumen"]["aplicada"], 1)
        obj.refresh_from_db()
        self.assertEqual((obj.finalizado_en, obj.plan_id, obj.desde, obj.nombre),
                         (None, self.plan.pk, date(2026, 8, 1), "PERSONA FICTICIA OSTEL 0001"))
        h = HistorialAfiliacion.objects.get(afiliado=obj, tipo="reactivacion")
        self.assertEqual((h.desde, h.motivo, h.origen, h.lote_id, h.plan_id),
                         (date(2026, 8, 1), MOTIVO, "importacion", lote["id"], self.plan.pk))
        self.assertTrue(HistorialAfiliacion.objects.filter(afiliado=obj, tipo="actualizacion", motivo=MOTIVO).exists())

    def test_solo_aplica_los_grupos_elegidos(self):
        activo = self.existente(2)
        lote = self.preview([fila(1), fila(2, FECBAJ=date(2026, 6, 30))])
        r = self.aplicar(lote, ["alta"])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([f["estado"] for f in r.data["filas"]], ["aplicada", "valida"])
        self.assertEqual(r.data["resumen"]["pendientes"], {"alta": 0, "modificacion": 0, "baja": 1, "reingreso": 0})
        activo.refresh_from_db()
        self.assertIsNone(activo.finalizado_en)

    def test_ausencia_en_el_lote_nunca_genera_baja(self):
        ausente = self.existente(9)
        lote = self.preview([fila(1)])
        self.assertEqual(lote["resumen"]["grupos"]["baja"], 0)
        r = self.aplicar(lote, ["alta", "modificacion", "baja", "reingreso"], confirmar_bajas=True)
        self.assertEqual(r.status_code, 200, r.data)
        ausente.refresh_from_db()
        self.assertIsNone(ausente.finalizado_en)
        self.assertFalse(HistorialAfiliacion.objects.filter(afiliado=ausente).exists())

    def test_motivo_y_grupos_validos_son_obligatorios(self):
        lote = self.preview([fila(1)])
        for grupos, motivo in ((["alta"], ""), (["alta"], "x" * 256), ([], MOTIVO), (["conflicto"], MOTIVO),
                               (["otro"], MOTIVO)):
            with self.subTest(grupos=grupos, motivo=len(motivo)):
                self.assertEqual(self.aplicar(lote, grupos, motivo).status_code, 400)
        self.assertFalse(Afiliado.objects.exists())

    def test_revalida_al_aplicar_y_lo_cambiado_pasa_a_conflicto(self):
        obj = self.existente(1)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        self.client.post(self.base + "finalizar-afiliacion/", {"afiliado": obj.pk, "motivo": "Cierre manual ficticio"},
                         format="json")
        obj.refresh_from_db()
        cierre = obj.finalizado_en
        r = self.aplicar(lote, ["baja"], confirmar_bajas=True)
        self.assertEqual(r.status_code, 200, r.data)
        f = r.data["filas"][0]
        self.assertEqual((f["estado"], f["grupo"]), ("revision", "conflicto"))
        obj.refresh_from_db()
        self.assertEqual((obj.finalizado_en, obj.motivo_finalizacion), (cierre, "Cierre manual ficticio"))

    def test_lote_anterior_sin_contrato_no_se_aplica_por_grupos(self):
        lote = self.preview([fila(1)])
        guardado = Importacion.objects.get(pk=lote["id"])
        del guardado.resumen["contrato"]
        guardado.save(update_fields=["resumen"])
        r = self.aplicar(lote, ["alta"])
        self.assertEqual(r.status_code, 400, r.data)
        self.assertIn("Este lote se preparó antes de los grupos mensuales. Cargá el archivo nuevamente.", str(r.data))
        self.assertFalse(Afiliado.objects.exists())

    # S3: subsanar conflictos ------------------------------------------------
    def test_subsanar_conflicto_reclasifica_la_fila(self):
        lote = self.preview([fila(1, CUIL="123")])
        f = self.unica(lote)
        self.assertEqual(f["grupo"], "conflicto")
        r = self.client.post(self.base + "subsanar-ostel/", {
            "importacion": lote["id"], "fila": f["fila"], "revision": f["revision"],
            "datos": {**f["datos"], "cuil": _cuil("99018501")}, "motivo": "CUIL verificado"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["filas"][0]["estado"], r.data["filas"][0]["grupo"]), ("valida", "alta"))
        self.assertEqual(r.data["resumen"]["grupos"]["alta"], 1)

    # Rutas manuales sin cambios ---------------------------------------------
    def test_finalizar_y_reactivar_manual_conservan_su_comportamiento(self):
        obj = self.existente(1)
        antes = timezone.now()
        r = self.client.post(self.base + "finalizar-afiliacion/", {"afiliado": obj.pk, "motivo": "Cierre manual"},
                             format="json")
        self.assertEqual(r.status_code, 200, r.data)
        obj.refresh_from_db()
        self.assertGreaterEqual(obj.finalizado_en, antes)
        self.assertLessEqual(obj.finalizado_en, timezone.now())
        h = HistorialAfiliacion.objects.get(afiliado=obj, tipo="finalizacion")
        self.assertEqual((h.desde, h.origen, h.lote_id, h.motivo), (timezone.localdate(), "manual", None, "Cierre manual"))
        r = self.client.post(self.base + "reactivar-afiliacion/", {
            "afiliado": obj.pk, "plan": self.plan.pk, "motivo": "Reingreso manual"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        obj.refresh_from_db()
        self.assertEqual((obj.finalizado_en, obj.desde, obj.plan_id), (None, timezone.localdate(), self.plan.pk))
        h = HistorialAfiliacion.objects.get(afiliado=obj, tipo="reactivacion")
        self.assertEqual((h.desde, h.origen, h.lote_id), (timezone.localdate(), "manual", None))


    # Verificación independiente: permisos, atomicidad por fila, ruta anterior y bordes de fecha.
    def test_aplicar_ostel_auditor_403_y_otro_financiador_400_sin_mutar(self):
        self.existente(1)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        MembresiaFinanciador.objects.filter(financiador=self.org, usuario=self.user).update(rol="auditor")
        antes = self.huella()
        self.assertEqual(self.aplicar(lote, ["baja"], confirmar_bajas=True).status_code, 403)
        self.assertEqual(self.huella(), antes)
        MembresiaFinanciador.objects.filter(financiador=self.org, usuario=self.user).update(rol="operador")
        otra = Financiador.objects.create(nombre="Otra ficticia", tipo="obra_social")
        MembresiaFinanciador.objects.create(financiador=otra, usuario=self.user, rol="operador")
        r = self.client.post(f"/api/financiadores/{otra.pk}/aplicar-ostel/", {
            "importacion": lote["id"], "grupos": ["baja"], "motivo": MOTIVO, "confirmar_bajas": True}, format="json")
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual(self.huella(), antes)

    def test_reingreso_atomico_si_falla_la_ficha(self):
        self.finalizado(1, nombre="NOMBRE ANTERIOR")
        lote = self.preview([fila(1, FECING=date(2026, 8, 1))])
        antes = self.huella()
        with mock.patch("apps.financiadores.padron.editar_ficha", side_effect=ValidationError("falla ficticia")):
            r = self.aplicar(lote, ["reingreso"])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["filas"][0]["estado"], r.data["filas"][0]["grupo"]), ("revision", "conflicto"))
        self.assertEqual(self.huella(), antes)

    def test_baja_atomica_si_falla_auditoria(self):
        self.existente(1)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30))])
        antes = self.huella()
        with mock.patch("apps.financiadores.vigencias.auditar", side_effect=ValidationError("falla ficticia")):
            r = self.aplicar(lote, ["baja"], confirmar_bajas=True)
        self.assertEqual((r.status_code, r.data["filas"][0]["estado"]), (200, "revision"))
        self.assertEqual(self.huella(), antes)

    def test_confirmacion_anterior_no_aplica_baja_ni_reingreso_validos(self):
        self.existente(1)
        self.finalizado(2)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30)), fila(2, FECING=date(2026, 8, 1)), fila(3)])
        self.assertEqual([f["grupo"] for f in lote["filas"]], ["baja", "reingreso", "alta"])
        r = self.client.post(self.base + "confirmar-importacion/", {"importacion": lote["id"]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(Afiliado.objects.get(documento="99018501").finalizado_en)
        self.assertIsNotNone(Afiliado.objects.get(documento="99018502").finalizado_en)
        self.assertEqual([f["estado"] for f in Importacion.objects.get(pk=lote["id"]).filas],
                         ["valida", "valida", "aplicada"])

    def test_bordes_de_fecha_baja_igual_a_desde_y_reingreso_dia_siguiente(self):
        self.existente(1, desde=date(2026, 6, 30))
        self.finalizado(2)
        lote = self.preview([fila(1, FECBAJ=date(2026, 6, 30), FECING=date(2026, 6, 30)),
                             fila(2, FECING=date(2026, 7, 2))])
        self.assertEqual([f["grupo"] for f in lote["filas"]], ["baja", "reingreso"])
        r = self.aplicar(lote, ["baja", "reingreso"], confirmar_bajas=True)
        self.assertEqual(r.data["resumen"]["aplicada"], 2, r.data)
