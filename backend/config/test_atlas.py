from rest_framework.test import APITestCase

from apps.simulacion.tests import EscenarioSimulacion, jwt


class AtlasAccessTests(EscenarioSimulacion, APITestCase):
    URL = "/api/atlas/"

    def test_anonymous_and_django_admin_session_do_not_get_the_atlas(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        self.client.force_login(self.root)
        self.assertEqual(self.client.get(self.URL).status_code, 401)

    def test_institution_admin_is_denied(self):
        response = self.client.get(self.URL, **jwt(self.admin_a))
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("html", response.data)

    def test_simulation_does_not_inherit_real_superuser_access(self):
        response = self.client.get(self.URL, **self.simular("plataforma", ambito="plataforma"))
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("html", response.data)

    def test_staff_without_superuser_privileges_is_denied(self):
        self.admin_a.is_staff = True
        self.admin_a.save(update_fields=["is_staff"])
        response = self.client.get(self.URL, **jwt(self.admin_a))
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("html", response.json())
        self.assertIn("no-store", response["Cache-Control"])

    def test_disabling_superuser_revokes_access(self):
        headers = jwt(self.root)
        self.root.is_active = False
        self.root.save(update_fields=["is_active"])
        response = self.client.get(self.URL, **headers)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("html", response.json())
        self.assertIn("no-store", response["Cache-Control"])

    def test_institution_user_cannot_reuse_platform_simulation(self):
        headers = self.simular("plataforma", ambito="plataforma")
        response = self.client.get(self.URL, **{**headers, **jwt(self.admin_a)})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("html", response.json())
        self.assertIn("no-store", response["Cache-Control"])

    def test_real_superuser_gets_a_private_non_cacheable_atlas(self):
        response = self.client.get(self.URL, **jwt(self.root))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("private", response["Cache-Control"])
        self.assertIn('id="mapa"', response.json()["html"])
        self.assertIn('id="f4"', response.json()["html"])
