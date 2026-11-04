import { defineRailway, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 50000 });
  const rakazoVolume = volume("rakazo-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 50000 });
  const rakazo = service("rakazo", {
    replicas: { "us-east4-eqdc4a": 1 },
    volumeMounts: { "/data": rakazoVolume },
    // These four were applied only to the first ad-hoc build (via railway.json) and
    // never persisted as durable service settings -- `railway config pull` came back
    // without them. Declaring them here is what actually makes them stick.
    builder: "DOCKERFILE",
    dockerfilePath: "infra/railway/Dockerfile",
    start: "bash infra/railway/entrypoint.sh",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
    env: { AGENT_RUNTIME: preserve(), API_HOST: preserve(), API_PROXY_TARGET: preserve(), API_URL: preserve(), BETTER_AUTH_SECRET: preserve(), BETTER_AUTH_URL: preserve(), COMPOSIO_API_KEY: preserve(), DATABASE_MIGRATION_URL: preserve(), DATABASE_URL: preserve(), DATA_DIR: preserve(), E2B_API_KEY: preserve(), ENCRYPTION_KEY: preserve(), MCP_STDIO_ALLOWED_COMMANDS: preserve(), MCP_STDIO_ENABLED: preserve(), NODE_ENV: preserve(), RAILWAY_DOCKERFILE_PATH: preserve(), RAKAZO_ADDITIONAL_ALLOWED_HOSTS: preserve(), RAKAZO_ALLOWED_HOSTS: preserve(), RAKAZO_HOST: preserve(), SANDBOX_IDLE_MS: preserve(), SANDBOX_PROVIDER: preserve(), SCREEN_PROXY_SECRET: preserve(), SENDBLUE_API_KEY_ID: preserve(), SENDBLUE_API_SECRET: preserve(), SENDBLUE_PHONE_NUMBER: preserve(), SENDBLUE_SIGNING_SECRET: preserve(), SIGNUPS_ENABLED: preserve(), SIGNUP_ALLOWLIST: preserve(), SLACK_BOT_TOKEN: preserve(), SLACK_SIGNING_SECRET: preserve(), WAKEUP_DRIVER: preserve(), WEB_ORIGIN: preserve() },
  });

  return project("rakazo", {
    resources: [Postgres, rakazo, postgresVolume, rakazoVolume],
  });
});
