"""Build the standalone PLEXO atlas and emit advisory PR warnings."""

import argparse
from collections import Counter
from fnmatch import fnmatchcase
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys


SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
STATUS = {
    "documented": "Comportamiento documentado · sin prueba en vivo",
    "verified": "Probado en un entorno de prueba · no confirma despliegue",
    "proposed": "Propuesta · no describe comportamiento disponible",
}
MARKER = re.compile(r"<!-- atlas:(f[1-9][0-9]*) -->")
NO_IMPACT = re.compile(
    r"^Atlas (F[1-9][0-9]*): sin impacto — (\S[^\r\n]*)$", re.MULTILINE,
)


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = Counter()
        self.links = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name == "id" and value:
                self.ids[value] += 1
            if name in {"href", "xlink:href"} and value:
                if not value.startswith("#"):
                    raise ValueError("Link is not local to the atlas")
                self.links.add(value[1:])
            if name == "src" and value and not value.startswith("data:image/"):
                raise ValueError("Atlas assets must be embedded")

    def check(self):
        duplicates = sorted(key for key, count in self.ids.items() if count > 1)
        if duplicates:
            raise ValueError("Duplicate IDs: " + ", ".join(duplicates))
        missing = sorted(self.links - self.ids.keys())
        if missing:
            raise ValueError("Broken links: " + ", ".join("#" + key for key in missing))


def read_text(path):
    return path.read_text(encoding="utf-8")


def read_manifest(source):
    flows = json.loads(read_text(source / "pilot.json"))
    if not isinstance(flows, dict) or not flows:
        raise ValueError("The pilot manifest must describe at least one flow")
    for key, flow in flows.items():
        if not re.fullmatch(r"f[1-9][0-9]*", key) or not isinstance(flow, dict):
            raise ValueError("Invalid flow identifier or record")
        if flow.get("status") not in STATUS:
            raise ValueError(f"Invalid status for {key}")
        for field in ("evidence", "paths"):
            values = flow.get(field)
            if not isinstance(values, list) or not all(isinstance(v, str) and v for v in values):
                raise ValueError(f"Invalid {field} for {key}")
    return flows


def render(source, flows):
    base = read_text(source / "reference.html")
    if Counter(MARKER.findall(base)) != Counter(flows.keys()):
        raise ValueError("Reference placeholders and pilot manifest do not match")

    def insert(match):
        key = match[1]
        content = read_text(source / f"{key}.html").strip()
        return content.replace("<!-- atlas:status -->", STATUS[flows[key]["status"]])

    page = MARKER.sub(insert, base)
    navigation_marker = "<!-- atlas:navigation -->"
    if navigation_marker in page:
        navigation = read_text(source / "navigation.js")
        page = page.replace(navigation_marker, f"<script>{navigation}</script>", 1)
    anchors = Anchors()
    anchors.feed(page)
    anchors.close()
    anchors.check()
    for key in flows:
        if key not in anchors.ids:
            raise ValueError(f"Chapter #{key} is absent")
    return page


def build(source, flows, output):
    page = render(source, flows)
    for key, flow in flows.items():
        if not flow["evidence"]:
            raise ValueError(f"Evidence is missing for {key}")
        for reference in flow["evidence"]:
            target = (ROOT / reference).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                raise ValueError(f"Evidence path is invalid for {key}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page, encoding="utf-8", newline="\n")


def review(flows, changes, body):
    changed = set(changes.read_bytes().decode("utf-8").split("\0"))
    exceptions = {
        flow.lower() for flow, reason in NO_IMPACT.findall(body) if reason.strip()
    }
    for key, details in flows.items():
        if not any(fnmatchcase(path, pattern) for path in changed for pattern in details["paths"]):
            continue
        name = key.upper()
        if changed & {f"backend/atlas_content/{key}.html", f"docs/atlas/{key}.html"}:
            print(f"Atlas {name}: flujo actualizado; revisar el cambio visual y su evidencia.")
        elif key in exceptions:
            print(f"Atlas {name}: sin impacto declarado; revisar el motivo en el PR.")
        else:
            print(
                f"::warning title=Atlas PLEXO::Revisar {name} y actualizar su flujo, "
                f"o declarar Atlas {name}: sin impacto — motivo en el PR."
            )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE, help="Atlas source directory")
    commands = parser.add_subparsers(dest="command", required=True)
    generate = commands.add_parser("build", help="Validate and generate standalone HTML")
    generate.add_argument("--output", type=Path, required=True)
    advisory = commands.add_parser("review", help="Run advisory review for changed paths")
    advisory.add_argument("--changes", type=Path, required=True, help="NUL-separated Git paths")
    declaration = advisory.add_mutually_exclusive_group()
    declaration.add_argument("--body", type=Path, help="Pull request description as UTF-8 text")
    declaration.add_argument("--event", type=Path, help="GitHub pull_request event payload")
    args = parser.parse_args()

    try:
        flows = read_manifest(args.source)
        if args.command == "build":
            build(args.source, flows, args.output)
        else:
            body = ""
            if args.body:
                body = read_text(args.body)
            elif args.event:
                body = json.loads(read_text(args.event))["pull_request"]["body"] or ""
            review(flows, args.changes, body)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Atlas: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
