"""Presentation of manual decisions without changing administrative semantics."""
from django.test import TestCase

from .test_novedades import NovedadesSetup


class ManualWorkflowTests(NovedadesSetup, TestCase):
    def listado(self):
        response = self.client.get(self.base + "novedades/")
        self.assertEqual(response.status_code, 200)
        return response.data["results"]

    def test_evidence_states_never_imply_a_coverage_decision(self):
        for state in ("pendiente", "conciliada", "descartada"):
            with self.subTest(state=state):
                proposal = self.crear(referencia=state)
                before = self.huella()
                if state != "pendiente":
                    response = self.client.post(
                        self.base + f"novedades/{proposal['id']}/resolver/",
                        self.decision(proposal, accion="conciliar" if state == "conciliada" else "descartar"),
                        format="json")
                    self.assertEqual(response.status_code, 200)
                row = next(row for row in self.listado() if row["id"] == proposal["id"])
                self.assertEqual(row["estado"], state)
                self.assertIsNone(row["habilitacion_cobertura"])
                self.assertFalse(row["efectos_aplicados"])
                self.assertEqual(self.huella(), before)

    def test_list_reports_changed_and_unchanged_decisions_without_private_fingerprint(self):
        for changed in (True, False):
            with self.subTest(changed=changed):
                self.afiliado.refresh_from_db()
                value = not self.afiliado.cobertura_habilitada if changed else self.afiliado.cobertura_habilitada
                proposal = self.conciliar(self.crear(referencia=str(changed)))
                response = self.habilitacion(proposal, habilitada=value)
                self.assertEqual(response.status_code, 200, response.data)
                row = next(row for row in self.listado() if row["id"] == proposal["id"])
                decision = row["habilitacion_cobertura"]
                self.assertEqual(decision["resultado"], "cambiada" if changed else "sin_cambios")
                self.assertEqual(decision["cobertura_habilitada"], value)
                self.assertEqual(set(decision), {"resultado", "cobertura_habilitada", "registrado"})
                self.assertEqual(decision["registrado"], response.data["habilitacion_cobertura"]["registrado"])
                self.assertFalse(row["efectos_aplicados"])

    def test_detail_identifies_rectifications_without_allowing_old_evidence(self):
        proposal = self.conciliar(self.crear(referencia="initial"))
        replacement = self.crear(referencia="replacement", rectifica=proposal["id"])
        response = self.client.get(self.base + f"novedades/{proposal['id']}/")
        self.assertEqual(response.data["rectificaciones"], [replacement["id"]])
        before = self.huella_propuestas_y_auditoria()
        rejected = self.habilitacion(response.data, habilitada=True)
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(self.huella_propuestas_y_auditoria(), before)
        current = self.client.get(self.base + f"novedades/{replacement['id']}/")
        self.assertEqual(current.data["rectificaciones"], [])
