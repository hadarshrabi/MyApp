#!/bin/sh
set -eu

backup_name=${BACKUP_FILE:?BACKUP_FILE must name a file inside /backups}
case "${backup_name}" in
  */*|*\\*|.|..|"")
    echo "BACKUP_FILE must be a plain file name, not a path" >&2
    exit 1
    ;;
esac

target_database=${PGDATABASE:?PGDATABASE is required}
confirmation=${RESTORE_CONFIRM_DATABASE:?RESTORE_CONFIRM_DATABASE must equal PGDATABASE}
if [ "${confirmation}" != "${target_database}" ]; then
  echo "Restore confirmation does not match target database" >&2
  exit 1
fi

backup_path="/backups/${backup_name}"
test -f "${backup_path}" || { echo "Backup not found: ${backup_path}" >&2; exit 1; }

if [ -f "${backup_path}.sha256" ]; then
  (cd /backups && sha256sum -c "${backup_name}.sha256")
fi

pg_restore --list "${backup_path}" >/dev/null
echo "Restoring ${backup_name} into ${target_database}"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --dbname="${target_database}" \
  "${backup_path}"

psql --dbname="${target_database}" --set=ON_ERROR_STOP=1 <<'SQL'
SELECT current_database() AS restored_database;
SELECT count(*) AS public_tables
FROM pg_catalog.pg_tables
WHERE schemaname = 'public';
SELECT count(*) AS applied_migrations
FROM public._prisma_migrations
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
SQL

echo "Restore verification completed"
