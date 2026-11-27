"""Reconcile the private attachments bucket using an authorized Railway CLI session."""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from config.almacenamiento import VARIABLES_OBLIGATORIAS, opciones_bucket  # noqa: E402

CONFIG = json.loads(Path(__file__).resolve().parents[1].joinpath("attachments.json").read_text(encoding="utf-8"))


class Railway:
    def __init__(self, project_id, executable="railway"):
        self.project_id = project_id
        self.executable = executable

    def run(self, *args, cwd=None, expect_json=True):
        try:
            result = subprocess.run(
                [self.executable, *args], cwd=cwd, capture_output=True, encoding="utf-8",
                errors="replace", check=True, timeout=90,
            )
            return json.loads(result.stdout) if expect_json else None
        except FileNotFoundError:
            raise ValueError("Railway executable not found; pass its native path with --railway-executable.") from None
        except (OSError, subprocess.SubprocessError, ValueError):
            # Railway errors or response bodies may contain resolved variables.
            raise ValueError(f"Railway {args[0]} failed; no response body was logged.") from None

    def api(self, query, field, **variables):
        response = self.run("api", query, "--compact", "--variables", json.dumps(variables))
        if response.get("errors") or field not in response.get("data", {}):
            raise ValueError(f"Railway API did not return {field}.")
        return response["data"][field]

    def assert_target(self, target):
        env = self.api(
            """query Target($id: String!) {
              environment(id: $id) { id name projectId
                serviceInstances { edges { node { serviceId serviceName } } pageInfo { hasNextPage } }
              }
            }""",
            "environment", id=target["environment_id"],
        )
        services = env["serviceInstances"]
        if (
            (env["id"], env["name"], env["projectId"])
            != (target["environment_id"], target["environment_name"], self.project_id)
            or services["pageInfo"]["hasNextPage"]
            or not any(
                (edge["node"]["serviceId"], edge["node"]["serviceName"])
                == (target["api_service_id"], target["api_service"])
                for edge in services["edges"]
            )
        ):
            raise ValueError("Railway environment/API identity does not match the manifest.")

    def bucket(self, target):
        project = self.api(
            """query Buckets($id: String!) {
              project(id: $id) {
                buckets(first: 100) { edges { node { id name deletedAt } } pageInfo { hasNextPage } }
              }
            }""",
            "project", id=self.project_id,
        )
        buckets = project["buckets"]
        found = [
            edge["node"]["id"] for edge in buckets["edges"]
            if edge["node"]["name"] == target["bucket"] and not edge["node"]["deletedAt"]
        ]
        if buckets["pageInfo"]["hasNextPage"] or len(found) > 1:
            raise ValueError("Cannot establish a unique project bucket.")
        if not found:
            return None
        details = self.api(
            """query Count($e: String!, $b: String!) {
              bucketInstanceDetails(environmentId: $e, bucketId: $b) { objectCount }
            }""",
            "bucketInstanceDetails", e=target["environment_id"], b=found[0],
        )
        if details is None:
            raise ValueError("Named bucket exists but has no instance in the target; reconcile it before retrying.")
        return found[0]

    def create_bucket(self, target):
        env = self.api(
            "query Pending($id: String!) { environment(id: $id) { unmergedChangesCount } }",
            "environment", id=target["environment_id"],
        )
        if env["unmergedChangesCount"]:
            raise ValueError("The target has pending Railway changes; resolve them before creating the bucket.")
        # bucket create lacks --project. Never re-link the caller's checkout.
        with TemporaryDirectory(prefix="plexo-railway-") as cwd:
            self.run(
                "link", "--project", self.project_id, "--environment", target["environment_id"],
                "--service", target["api_service_id"], "--json", cwd=cwd, expect_json=False,
            )
            try:
                self.run(
                    "bucket", "create", target["bucket"], "--environment", target["environment_id"],
                    "--region", target["bucket_region"], "--json", cwd=cwd,
                )
            finally:
                self.run("unlink", "--yes", "--json", cwd=cwd, expect_json=False)

    def addressing_style(self, target, bucket_id):
        metadata = self.api(
            """query Addressing($p: String!, $e: String!, $b: String!) {
              bucketS3Credentials(projectId: $p, environmentId: $e, bucketId: $b) { urlStyle }
            }""",
            "bucketS3Credentials", p=self.project_id, e=target["environment_id"], b=bucket_id,
        )
        if len(metadata) == 1:
            style = {"virtual-host": "virtual", "path-style": "path"}.get(metadata[0]["urlStyle"])
            if style:
                return style
        raise ValueError("Cannot determine S3 addressing style for the target bucket.")

    def raw_variables(self, target):
        return self.api(
            """query RawVars($p: String!, $e: String!, $s: String!) {
              variables(projectId: $p, environmentId: $e, serviceId: $s, unrendered: true)
            }""",
            "variables", p=self.project_id, e=target["environment_id"], s=target["api_service_id"],
        )

    def resolved_variables(self, target):
        return self.api(
            """query DeployVars($p: String!, $e: String!, $s: String!) {
              variablesForServiceDeployment(projectId: $p, environmentId: $e, serviceId: $s)
            }""",
            "variablesForServiceDeployment", p=self.project_id, e=target["environment_id"], s=target["api_service_id"],
        )

    def upsert(self, target, variables, *, skip_deploys):
        if not self.api(
            "mutation Wire($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }",
            "variableCollectionUpsert", input={
                "projectId": self.project_id, "environmentId": target["environment_id"],
                "serviceId": target["api_service_id"], "replace": False, "skipDeploys": skip_deploys,
                "variables": variables,
            },
        ):
            raise ValueError("Railway did not accept the variable update.")


def reconcile(railway, target, *, check):
    specs = CONFIG["variables"]
    if set(VARIABLES_OBLIGATORIAS) != {key for key in specs if specs[key]["required_for_s3"]}:
        raise ValueError("The manifest no longer matches the backend S3 configuration contract.")
    railway.assert_target(target)
    bucket_id = railway.bucket(target)
    if bucket_id is None and not check:
        railway.create_bucket(target)
        bucket_id = railway.bucket(target)
    if bucket_id is None:
        raise ValueError("The managed bucket is missing in the target environment.")

    desired = {"BUCKET_ADDRESSING_STYLE": railway.addressing_style(target, bucket_id)}
    for key, spec in specs.items():
        if "railway_reference" in spec:
            desired[key] = "$" + "{{" + target["bucket"] + "." + spec["railway_reference"] + "}}"
        elif "railway_value" in spec:
            desired[key] = spec["railway_value"]
    current = railway.raw_variables(target)
    changes = {key: value for key, value in desired.items() if current.get(key) != value}
    if changes and not check:
        railway.upsert(target, changes, skip_deploys=True)
        current = railway.raw_variables(target)
    drift = sorted(key for key in desired if current.get(key) != desired[key])
    if drift:
        raise ValueError("Managed Railway variables do not match: " + ", ".join(drift))

    resolved = railway.resolved_variables(target)
    resolved = {
        key: value.strip() for key, value in resolved.items()
        if key in desired and isinstance(value, str) and value.strip() and ("$" + "{{") not in value
    }
    if opciones_bucket(resolved) is None:
        raise ValueError("No S3 variables resolved; refusing the local-disk fallback.")
    missing = sorted(desired.keys() - resolved.keys())
    if missing:
        raise ValueError("Railway variables did not resolve: " + ", ".join(missing))
    print(f'{target["environment_name"]}: {target["bucket"]} and API variables verified; no deploy requested.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=CONFIG["environments"])
    parser.add_argument("--check", action="store_true", help="Verify only; do not create or update resources.")
    parser.add_argument("--railway-executable", default="railway", help="Native Railway CLI path (not a shell shim).")
    args = parser.parse_args()
    try:
        railway = Railway(CONFIG["railway_project_id"], args.railway_executable)
        reconcile(railway, CONFIG["environments"][args.environment], check=args.check)
    except ValueError as exc:
        parser.exit(1, f"Attachments: {exc}\n")


if __name__ == "__main__":
    main()
