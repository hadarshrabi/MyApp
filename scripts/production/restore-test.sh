#!/bin/sh
set -eu

env_file=${PRODUCTION_ENV_FILE:-.env.production}
backup_name=${1:-}

if [ -z "${backup_name}" ]; then
  backup_dir=$(sed -n 's/^BACKUP_DIR=//p' "${env_file}" | tail -n 1)
  backup_dir=${backup_dir:-./backups}
  latest_path=$(find "${backup_dir}" -maxdepth 1 -type f -name '*.dump' | sort | tail -n 1)
  test -n "${latest_path}" || { echo "No backup file found in ${backup_dir}" >&2; exit 1; }
  backup_name=$(basename "${latest_path}")
fi

cleanup() {
  BACKUP_FILE="${backup_name}" docker compose \
    --env-file "${env_file}" \
    -f compose.production.yml \
    -f compose.restore-test.yml \
    --profile restore-test \
    rm -sf restore-test restore-test-db >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Starting an isolated temporary restore database"
BACKUP_FILE="${backup_name}" docker compose \
  --env-file "${env_file}" \
  -f compose.production.yml \
  -f compose.restore-test.yml \
  --profile restore-test \
  up -d --wait restore-test-db

BACKUP_FILE="${backup_name}" docker compose \
  --env-file "${env_file}" \
  -f compose.production.yml \
  -f compose.restore-test.yml \
  --profile restore-test \
  run --rm restore-test

echo "Restore test passed for ${backup_name}"
