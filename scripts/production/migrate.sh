#!/bin/sh
set -eu

compose_file=${COMPOSE_FILE:-compose.production.yml}
env_file=${PRODUCTION_ENV_FILE:-.env.production}

test -f "${env_file}" || { echo "Missing environment file: ${env_file}" >&2; exit 1; }

echo "Starting PostgreSQL and waiting for its health check"
docker compose --env-file "${env_file}" -f "${compose_file}" up -d --wait postgres

echo "Creating a pre-migration backup"
docker compose --env-file "${env_file}" -f "${compose_file}" --profile operations run --rm backup

echo "Running the immutable migration image as a one-shot job"
docker compose --env-file "${env_file}" -f "${compose_file}" --profile operations run --rm migration

echo "Migration completed successfully"
