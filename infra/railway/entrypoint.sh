#!/usr/bin/env bash
# Railway runs Rakazo's API, Graphile worker, and web preview in a single service
# because Railway attaches a volume to exactly one service, and DATA_DIR must be
# shared by the API and worker (see docs/self-host.md, "What Rakazo Cloud still needs").
#
# There is no Caddy here: Railway terminates TLS and routes the public domain to $PORT.
set -uo pipefail

log() { echo "[rakazo-entrypoint] $*"; }

# The image runs as root (Railway's SSH does not attach to a container whose image
# sets a non-root USER), so fix the volume's ownership and drop to node, as upstream's
# infra/railway/start.sh does. Older deploys wrote /data as root, so hand everything
# over once rather than only the top directory.
if [[ $(id -u) == 0 ]]; then
  install -d -m 750 -o node -g node /data /app/apps/web/asset-archive
  if [[ -n $(find /data ! -user node -print -quit) ]]; then
    log "Handing /data to node..."
    chown -R node:node /data
  fi
  exec gosu node "$0" "$@"
fi

# Vite's preview server reads WEB_PORT; Railway assigns the public port via PORT.
export WEB_PORT="${PORT:-5173}"

# Migrations run before anything serves, matching the ordering the API start
# command guarantees in docker-compose.prod.yml.
# With DATABASE_MIGRATION_URL set to the owner and DATABASE_URL to the app login,
# row-level security is enforced. Migrate as the owner, then start over without the
# owner login: unset alone would leave it in this shell's environment, which any
# process running as node can read from /proc.
if [[ "${1:-}" != serve ]]; then
  log "Running database migrations..."
  if ! pnpm --filter @rakazo/api db:deploy; then
    log "Migrations failed; refusing to start."
    exit 1
  fi
  exec env -u DATABASE_MIGRATION_URL bash "$0" serve
fi

pids=()

shutdown() {
  log "Shutting down child processes..."
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap shutdown EXIT INT TERM

log "Starting Graphile worker..."
pnpm --filter @rakazo/worker start &
pids+=("$!")

log "Starting web preview on port ${WEB_PORT}..."
pnpm --filter @rakazo/web preview &
pids+=("$!")

log "Starting API on port 3100..."
pnpm --filter @rakazo/api start &
pids+=("$!")

# Exit as soon as ANY of the three exits. Railway then restarts the whole service.
# Without this the container would keep passing health checks with a dead worker.
if wait -n; then
  status=0
else
  status=$?
fi

log "A service exited with status ${status}; restarting the Railway service."
exit "${status:-1}"
