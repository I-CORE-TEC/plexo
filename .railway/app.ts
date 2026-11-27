// Railway Infrastructure as Code for the PLEXO API and web services (#234).
//
// Named partial: this file owns the build/deploy settings of the API and web
// services of the target environment. Their variables are listed only by name
// with preserve(): the values (secrets, domains, bucket credentials) stay in
// Railway and are never written here. A variable missing from these lists is
// planned for DELETION, so add new variable names here before applying.
// The geografia cron lives in railway.ts (partial "geografia").
//
//   cd .railway && npm ci
//   railway link            # pick project PLEXO and the target environment
//   railway config plan --file .railway/app.ts
//   railway config apply --file .railway/app.ts   # only after reviewing the plan
//
// See docs/entornos/qa-railway.md for the deploy flow and diagnosis.
import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "app";

// Values live in Railway; see the header comment.
const API_VARIABLES = [
  "ACCESS_KEY_ID",
  "BUCKET",
  "BUCKET_ADDRESSING_STYLE",
  "CORS_ALLOWED_ORIGINS",
  "DATABASE_SSL",
  "DATABASE_URL",
  "DEMO_PASSWORD",
  "DJANGO_ALLOWED_HOSTS",
  "DJANGO_DEBUG",
  "DJANGO_SECRET_KEY",
  "EJECUTAR_MIGRACIONES",
  "EMAIL_BACKEND",
  "ENDPOINT",
  "ENTORNO",
  "PORT",
  "PORTAL_URL_BASE",
  "REGION",
  "RENAPER_MODO",
  "SALUD_FACTURAS_ADJUNTOS",
  "SALUD_INTEGRACIONES_PERMITIDAS",
  "SECRET_ACCESS_KEY",
  "SEED_DEMO",
  "SEED_GUARDIA",
] as const;
const WEB_VARIABLES = ["NGINX_CONF", "PORT", "VITE_API_URL", "VITE_NOMBRE_SISTEMA"] as const;
const preserved = (names: readonly string[]) =>
  Object.fromEntries(names.map((name) => [name, preserve()]));

// Railway environment name -> service prefix and git branch it deploys.
// Only QA is connected to GitHub. AGC still deploys from manual uploads and is
// added here when it is connected to the `agc` branch.
const ENTORNOS: Record<string, { prefijo: string; rama: string }> = {
  QA: { prefijo: "plexo-qa", rama: "qa" },
};

export default defineRailway((ctx) => {
  const entorno = ENTORNOS[ctx.environment];
  if (!entorno) {
    throw new Error(`Environment ${ctx.environment} is not mapped in .railway/app.ts.`);
  }

  // dockerfilePath must stay RELATIVE: it resolves inside rootDirectory. An
  // absolute "/Dockerfile" resolves against the repository root, which has no
  // Dockerfile, and every build failed with "failed to read Dockerfile".
  const api = service(`${entorno.prefijo}-api`, {
    source: github("I-CORE-TEC/plexo", { branch: entorno.rama, rootDirectory: "/backend" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      // entrypoint.sh applies migrations (EJECUTAR_MIGRACIONES=1) before gunicorn.
      startCommand: "/entrypoint.sh gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3",
      healthcheckPath: "/api/health/",
      healthcheckTimeout: 240,
      restartPolicyMaxRetries: 4,
    },
    env: preserved(API_VARIABLES),
  });

  const web = service(`${entorno.prefijo}-web`, {
    source: github("I-CORE-TEC/plexo", { branch: entorno.rama, rootDirectory: "/frontend" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      healthcheckPath: "/",
      healthcheckTimeout: 120,
      restartPolicyMaxRetries: 4,
    },
    env: preserved(WEB_VARIABLES),
  });

  return project("PLEXO", { resources: [api, web] });
});
