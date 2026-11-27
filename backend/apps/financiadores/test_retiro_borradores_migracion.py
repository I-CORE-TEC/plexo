"""Dropping the retired rights drafts archives every row as an audit event (#216)."""
from datetime import date

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

PREVIO = [("financiadores", "0021_prescripcion_autorizacion")]
RETIRO = [("financiadores", "0022_retirar_borradorregladerechos")]
TABLA = "financiadores_borradorregladerechos"


class RetiroBorradoresMigracionTests(TransactionTestCase):
    def setUp(self):
        self.finales = MigrationExecutor(connection).loader.graph.leaf_nodes()

    def tearDown(self):
        MigrationExecutor(connection).migrate(self.finales)

    def migrar(self, destino):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(destino)
        return executor.loader.project_state(destino).apps

    def tablas(self):
        with connection.cursor() as cursor:
            return connection.introspection.table_names(cursor)

    def test_cada_borrador_queda_archivado_como_evento_antes_de_borrar_la_tabla(self):
        apps = self.migrar(PREVIO)
        Financiador = apps.get_model("financiadores", "Financiador")
        Plan = apps.get_model("financiadores", "Plan")
        Usuario = apps.get_model("accounts", "Usuario")
        Borrador = apps.get_model("financiadores", "BorradorReglaDerechos")
        org = Financiador.objects.create(nombre="Financiador ficticio", tipo="otro")
        plan = Plan.objects.create(financiador=org, codigo="plan-ficticio", nombre="Plan ficticio")
        autor = Usuario.objects.create(email="autor-borrador@example.invalid")
        otro = Usuario.objects.create(email="otro-borrador@example.invalid")
        general = Borrador.objects.create(
            financiador=org, regimen="dependencia", codigo="regla-general", version=1,
            fuente="Fuente ficticia", desde=date(2029, 1, 1), hasta=date(2029, 12, 31),
            plazo_dias_corridos=90, creado_por=autor, motivo="Motivo original ficticio")
        con_plan = Borrador.objects.create(
            financiador=org, plan=plan, regimen="monotributo", codigo="regla-plan", version=2,
            fuente="Fuente ficticia", desde=date(2030, 1, 1), creado_por=otro,
            motivo="x" * 255)

        apps = self.migrar(RETIRO)

        self.assertNotIn(TABLA, self.tablas())
        Evento = apps.get_model("financiadores", "EventoCobertura")
        eventos = {e.objeto: e for e in Evento.objects.filter(accion="retirar_borrador_derechos")}
        self.assertEqual(Evento.objects.count(), 2)
        self.assertEqual(set(eventos), {f"BorradorReglaDerechos:{general.pk}",
                                        f"BorradorReglaDerechos:{con_plan.pk}"})
        primero = eventos[f"BorradorReglaDerechos:{general.pk}"]
        segundo = eventos[f"BorradorReglaDerechos:{con_plan.pk}"]
        self.assertEqual((primero.financiador_id, primero.usuario_id), (org.pk, autor.pk))
        self.assertEqual((segundo.financiador_id, segundo.usuario_id), (org.pk, otro.pk))
        for texto in ("regla-general", "v1", "dependencia", "2029-01-01", "2029-12-31", "90",
                      "Motivo original ficticio"):
            self.assertIn(texto, primero.motivo)
        self.assertIn("regla-plan", segundo.motivo)
        self.assertIn(f"plan={plan.pk}", segundo.motivo)
        self.assertLessEqual(len(segundo.motivo), 255)

    def test_tabla_vacia_no_crea_eventos_y_la_migracion_se_revierte_vacia(self):
        self.migrar(PREVIO)
        apps = self.migrar(RETIRO)
        self.assertNotIn(TABLA, self.tablas())
        self.assertEqual(apps.get_model("financiadores", "EventoCobertura").objects.count(), 0)

        apps = self.migrar(PREVIO)
        self.assertIn(TABLA, self.tablas())
        self.assertEqual(apps.get_model("financiadores", "BorradorReglaDerechos").objects.count(), 0)
