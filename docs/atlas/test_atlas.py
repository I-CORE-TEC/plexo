import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SOURCE = Path(__file__).with_name("atlas.py").resolve()


class AtlasCLI(unittest.TestCase):
    def run_atlas(self, *args):
        return subprocess.run(
            [sys.executable, str(SOURCE), *map(str, args)],
            capture_output=True, text=True, encoding="utf-8",
        )

    def test_build_is_deterministic_and_preserves_navigation(self):
        with tempfile.TemporaryDirectory() as temp:
            first, second = (Path(temp) / name for name in ("a.html", "b.html"))
            for output in (first, second):
                result = self.run_atlas("build", "--output", output)
                self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            page = first.read_text(encoding="utf-8")
            self.assertEqual(page.count('class="chapter" id="f'), 23)
            self.assertIn('href="#f4"', page)
            self.assertIn('href="#f5"', page)
            self.assertEqual(page.count('data-atlas-mode="pilot"'), 2)
            self.assertEqual(page.count('data-atlas-mode="reference"'), 21)

    def test_build_rejects_a_broken_fragment_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            fixture = {"f1": {"evidence": [], "status": "documented", "paths": []}}
            (root / "pilot.json").write_text(json.dumps(fixture), encoding="utf-8")
            (root / "reference.html").write_text("<!-- atlas:f1 -->", encoding="utf-8")
            (root / "f1.html").write_text(
                '<section id="f1"><a href="#missing">Go</a></section>', encoding="utf-8",
            )
            output = root / "out.html"
            result = self.run_atlas("--source", root, "build", "--output", output)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("#missing", result.stderr)
            self.assertFalse(output.exists())

    def test_review_warns_only_for_affected_undeclared_flows(self):
        with tempfile.TemporaryDirectory() as temp:
            changes, event = Path(temp) / "changes", Path(temp) / "event.json"
            files = [b"backend/apps/financiadores/cobertura.py", b"backend/apps/financiadores/api_autorizaciones.py"]
            changes.write_bytes(b"\0".join(files) + b"\0")
            event.write_text(
                json.dumps({"pull_request": {"body": "Atlas F1: sin impacto — refactor interno\n"}}),
                encoding="utf-8",
            )
            result = self.run_atlas("review", "--changes", changes, "--event", event)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("::warning", result.stdout)
            self.assertIn("F4", result.stdout)
            self.assertNotIn(" F1 ", result.stdout)
            self.assertNotIn("refactor interno", result.stdout)

    def test_review_accepts_updated_flow_and_ignores_unrelated_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            changes = Path(temp) / "changes"
            changes.write_bytes(
                b"backend/apps/financiadores/cobertura.py\0docs/atlas/f1.html\0"
                b"backend/apps/farmacia/models.py\0",
            )
            result = self.run_atlas("review", "--changes", changes)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn("::warning", result.stdout)
            self.assertIn("F1", result.stdout)
            self.assertNotIn("F4", result.stdout)


if __name__ == "__main__":
    unittest.main()
