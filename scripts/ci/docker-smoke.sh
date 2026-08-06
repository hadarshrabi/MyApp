#!/usr/bin/env sh
set -eu

application_image="${1:?application image is required}"
migration_image="${2:?migration image is required}"
run_suffix="${GITHUB_RUN_ID:-local}-$$"
network_name="linoy-ci-${run_suffix}"
postgres_name="linoy-postgres-${run_suffix}"
application_name="linoy-application-${run_suffix}"
host_port="${SMOKE_TEST_PORT:-3001}"
database_name="linoy_smoke"
database_user="postgres"
database_password="ci-postgres-password"
database_url="postgresql://${database_user}:${database_password}@${postgres_name}:5432/${database_name}?schema=public"

cleanup() {
  docker rm -f "$application_name" "$postgres_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
}

show_diagnostics() {
  echo "PostgreSQL logs:"
  docker logs "$postgres_name" 2>&1 || true
  echo "Application logs:"
  docker logs "$application_name" 2>&1 || true
}

trap cleanup EXIT INT TERM

docker network create "$network_name" >/dev/null
docker run --detach \
  --name "$postgres_name" \
  --network "$network_name" \
  --env POSTGRES_DB="$database_name" \
  --env POSTGRES_USER="$database_user" \
  --env POSTGRES_PASSWORD="$database_password" \
  postgres:17-alpine >/dev/null

postgres_ready=false
attempt=1
while [ "$attempt" -le 30 ]; do
  if docker exec "$postgres_name" pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
    postgres_ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$postgres_ready" != "true" ]; then
  show_diagnostics
  echo "PostgreSQL did not become ready in time" >&2
  exit 1
fi

docker run --rm \
  --network "$network_name" \
  --env DATABASE_URL="$database_url" \
  "$migration_image"

docker run --detach \
  --name "$application_name" \
  --network "$network_name" \
  --publish "127.0.0.1:${host_port}:3001" \
  --env DATABASE_URL="$database_url" \
  --env JWT_ACCESS_SECRET="ci-only-access-secret-that-is-longer-than-thirty-two-characters" \
  --env JWT_ISSUER="linoy-designs-api" \
  --env JWT_AUDIENCE="linoy-designs-app" \
  --env APP_ORIGIN="http://127.0.0.1:${host_port}" \
  --env NODE_ENV="production" \
  --env HOST="0.0.0.0" \
  --env PORT="3001" \
  --env SHUTDOWN_TIMEOUT_MS="5000" \
  "$application_image" >/dev/null

application_ready=false
attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent --show-error "http://127.0.0.1:${host_port}/api/health/live" >/dev/null 2>&1 && \
     curl --fail --silent --show-error "http://127.0.0.1:${host_port}/api/health/ready" >/dev/null 2>&1; then
    application_ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$application_ready" != "true" ]; then
  show_diagnostics
  echo "Application did not become ready in time" >&2
  exit 1
fi

curl --fail --silent --show-error "http://127.0.0.1:${host_port}/login" | grep --quiet 'id="root"'

docker stop --time 8 "$application_name" >/dev/null
application_status="$(docker inspect --format '{{.State.ExitCode}}' "$application_name")"
if [ "$application_status" -ne 0 ]; then
  show_diagnostics
  echo "Application exited with status ${application_status} after SIGTERM" >&2
  exit 1
fi

echo "Container smoke test passed"
