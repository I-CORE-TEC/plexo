// Railway Infrastructure as Code for the weekly Georef catalog sync (#136, #234).
//
// Named partial: this file owns ONLY the geografia cron service of the target
// environment. The API, web, database and bucket services are not declared here,
// so a plan/apply from this file can never change or delete them.
//
//   cd .railway && npm ci
//   railway link            # pick project PLEXO and the target environment
//   railway config plan     # review
//   railway config apply    # only after reviewing the plan
//
// See docs/entornos/geografia-railway.md for the full runbook and for running
// the same command on other infrastructure (crontab, docker compose, Kubernetes).
import { defineRailway, github, project, service } from "railway/iac";

export const partial = "geografia";

// Railway environment name -> service prefix and git branch it deploys.
const ENTORNOS: Record<string, { prefijo: string; rama: string }> = {
  QA: { prefijo: "plexo-qa", rama: "qa" },
  AGC: { prefijo: "plexo-agc", rama: "agc" },
};

export default defineRailway((ctx) => {
  const entorno = ENTORNOS[ctx.environment];
  if (!entorno) {
    throw new Error(`Environment ${ctx.environment} is not mapped in .railway/railway.ts.`);
  }
  // Reference the API service variables instead of copying secrets. The API
  // service is owned elsewhere; a reference string does not claim it.
  const api = (nombre: string) => `\${{${entorno.prefijo}-api.${nombre}}}`;

  const geografia = service(`${entorno.prefijo}-geografia`, {
    source: github("I-CORE-TEC/plexo", { branch: entorno.rama, rootDirectory: "/backend" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/backend/**"] },
    deploy: {
      // Runs once and exits: syncs only when the catalog is older than a week
      // (at most one retry per day after a failure). See sincronizar_geografia.
      startCommand: "/entrypoint.sh python manage.py sincronizar_geografia --si-corresponde",
      cronSchedule: "0 6 * * *", // daily 03:00 Argentina (UTC-3)
      restartPolicyType: "NEVER",
      numReplicas: 1,
    },
    env: {
      DATABASE_URL: api("DATABASE_URL"),
      DATABASE_SSL: api("DATABASE_SSL"),
      DJANGO_SECRET_KEY: api("DJANGO_SECRET_KEY"),
      ENTORNO: api("ENTORNO"),
      DJANGO_DEBUG: "0",
      DJANGO_ALLOWED_HOSTS: "localhost,127.0.0.1",
      // The API applies migrations; the cron never migrates nor seeds.
      EJECUTAR_MIGRACIONES: "0",
      SEED_DEMO: "0",
      SEED_GUARDIA: "0",
      PYTHONUNBUFFERED: "1",
    },
  });

  return project("PLEXO", { resources: [geografia] });
});
