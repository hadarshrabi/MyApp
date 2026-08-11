#!/bin/sh
set -eu

umask 077

backup_dir=/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database_name=${PGDATABASE:?PGDATABASE is required}
final_file="${backup_dir}/${database_name}-${timestamp}.dump"
temporary_file="${final_file}.partial"

mkdir -p "${backup_dir}"
trap 'rm -f "${temporary_file}"' EXIT INT TERM

echo "Creating PostgreSQL backup for ${database_name}"
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="${temporary_file}"

pg_restore --list "${temporary_file}" >/dev/null
mv "${temporary_file}" "${final_file}"
sha256sum "${final_file}" > "${final_file}.sha256"

retention_days=${BACKUP_RETENTION_DAYS:-7}
find "${backup_dir}" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+${retention_days}" -delete

echo "Backup completed: ${final_file}"
cat "${final_file}.sha256"
