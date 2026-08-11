#!/bin/sh
set -eu

compose_file=${COMPOSE_FILE:-compose.production.yml}
env_file=${PRODUCTION_ENV_FILE:-.env.production}
rollback_image=${ROLLBACK_APP_IMAGE:-$(sed -n 's/^ROLLBACK_APP_IMAGE=//p' "${env_file}" | tail -n 1)}
test -n "${rollback_image}" || { echo "ROLLBACK_APP_IMAGE is required" >&2; exit 1; }

case "${rollback_image}" in
  *@sha256:*) ;;
  *) echo "ROLLBACK_APP_IMAGE must be an immutable digest reference" >&2; exit 1 ;;
esac

echo "Rolling application back to ${rollback_image}"
APP_IMAGE="${rollback_image}" docker compose --env-file "${env_file}" -f "${compose_file}" pull app
APP_IMAGE="${rollback_image}" docker compose --env-file "${env_file}" -f "${compose_file}" up -d --wait --no-deps app

https_port=$(sed -n 's/^HTTPS_PORT=//p' "${env_file}" | tail -n 1)
https_port=${https_port:-8443}

attempt=1
while [ "${attempt}" -le 12 ]; do
  if curl --fail --silent --show-error --insecure "https://localhost:${https_port}/api/health/ready" >/dev/null 2>&1; then
    break
  fi
  if [ "${attempt}" -eq 12 ]; then
    echo "Rollback readiness failed after 60 seconds" >&2
    exit 1
  fi
  sleep 5
  attempt=$((attempt + 1))
done

echo "Application rollback verification completed"
echo "Database schema was not rolled back"
