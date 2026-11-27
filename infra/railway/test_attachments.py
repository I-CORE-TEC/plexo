import contextlib
import io
import unittest
from unittest.mock import Mock

from attachments import CONFIG, Railway, reconcile


class ReconcileTests(unittest.TestCase):
    def setUp(self):
        self.target = CONFIG["environments"]["QA"]
        self.railway = Mock(spec=Railway)
        self.railway.bucket.return_value = "qa-bucket-id"
        self.railway.addressing_style.return_value = "virtual"
        self.railway.raw_variables.return_value = {}
        self.railway.resolved_variables.return_value = {
            "BUCKET": "qa-s3-bucket",
            "ACCESS_KEY_ID": "example-access-key",
            "SECRET_ACCESS_KEY": "must-never-appear-in-output",
            "ENDPOINT": "https://s3.example.invalid",
            "REGION": "auto",
            "BUCKET_ADDRESSING_STYLE": "virtual",
            "SALUD_FACTURAS_ADJUNTOS": "true",
        }

    def test_creates_missing_bucket_and_updates_only_managed_values_without_deploy(self):
        self.railway.bucket.side_effect = [None, "qa-bucket-id"]
        expected = {
            key: "${{" + self.target["bucket"] + "." + key + "}}"
            for key in ("BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "REGION")
        }
        expected.update(BUCKET_ADDRESSING_STYLE="virtual", SALUD_FACTURAS_ADJUNTOS="true")
        self.railway.raw_variables.side_effect = [{"OTHER": "keep"}, expected]

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            reconcile(self.railway, self.target, check=False)

        self.railway.assert_target.assert_called_once_with(self.target)
        self.railway.create_bucket.assert_called_once_with(self.target)
        self.railway.upsert.assert_called_once_with(self.target, expected, skip_deploys=True)
        self.assertNotIn("must-never-appear-in-output", out.getvalue())

        self.railway.bucket.side_effect = None
        self.railway.raw_variables.side_effect = None
        self.railway.raw_variables.return_value = expected
        with contextlib.redirect_stdout(io.StringIO()):
            reconcile(self.railway, self.target, check=False)
        self.assertEqual(self.railway.create_bucket.call_count, 1)
        self.assertEqual(self.railway.upsert.call_count, 1)

    def test_read_only_check_rejects_drift_and_never_writes(self):
        with self.assertRaisesRegex(ValueError, "BUCKET"):
            reconcile(self.railway, self.target, check=True)
        self.railway.create_bucket.assert_not_called()
        self.railway.upsert.assert_not_called()

    def test_fails_with_existing_backend_error_when_a_reference_does_not_resolve(self):
        self.railway.resolved_variables.return_value["SECRET_ACCESS_KEY"] = "${{unresolved}}"
        self.railway.raw_variables.return_value = {
            key: "${{" + self.target["bucket"] + "." + key + "}}"
            for key in ("BUCKET", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "REGION")
        } | {"BUCKET_ADDRESSING_STYLE": "virtual", "SALUD_FACTURAS_ADJUNTOS": "true"}

        with self.assertRaisesRegex(ValueError, "bucket incompleta: faltan SECRET_ACCESS_KEY"):
            reconcile(self.railway, self.target, check=True)
        self.railway.upsert.assert_not_called()
