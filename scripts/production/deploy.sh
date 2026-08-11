#!/bin/sh
set -eu

compose_file=${COMPOSE_FILE:-compose.production.yml}
env_file=${PRODUCTION_ENV_FILE:-.env.production}

test -f "${env_file}" || { echo "Missing environment file: ${env_file}" >&2; exit 1; }

app_image=$(sed -n 's/^APP_IMAGE=//p' "${env_file}" | tail -n 1)
migration_image=$(sed -n 's/^MIGRATION_IMAGE=//p' "${env_file}" | tail -n 1)
case "${app_image}" in *@sha256:*) ;; *) echo "APP_IMAGE must be pinned by digest" >&2; exit 1;; esac
case "${migration_image}" in *@sha256:*) ;; *) echo "MIGRATION_IMAGE must be pinned by digest" >&2; exit 1;; esac

echo "Pulling the exact application and migration artifacts"
docker compose --env-file "${env_file}" -f "${compose_file}" --profile operations pull app migration

PRODUCTION_ENV_FILE="${env_file}" COMPOSE_FILE="${compose_file}" sh scripts/production/migrate.sh

echo "Updating application and reverse proxy only after migration succeeded"
docker compose --env-file "${env_file}" -f "${compose_file}" up -d --wait app caddy

https_port=$(sed -n 's/^HTTPS_PORT=//p' "${env_file}" | tail -n 1)
https_port=${https_port:-8443}

probe() {
  url=$1
  attempt=1
  while [ "${attempt}" -le 12 ]; do
    if curl --fail --silent --show-error --insecure "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
    attempt=$((attempt + 1))
  done
  echo "Health probe failed after 60 seconds: ${url}" >&2
  return 1
}

probe "https://localhost:${https_port}/api/health/live"
probe "https://localhost:${https_port}/api/health/ready"
probe "https://localhost:${https_port}/"

echo "Deployment verification completed"
