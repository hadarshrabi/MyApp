# PostgreSQL backup and restore

The production Compose stack provides a one-shot `backup` service. It connects
to PostgreSQL over the internal Docker network; PostgreSQL is not published to
the host.

## Backup format and safety

- `pg_dump --format=custom --compress=9`
- no ownership or ACL statements
- restrictive `umask 077`
- temporary `.partial` file followed by an atomic rename
- `pg_restore --list` validation before completion
- SHA-256 checksum next to every dump
- configurable local retention with `BACKUP_RETENTION_DAYS`

Run a backup:

```bash
docker compose --env-file .env.production \
  -f compose.production.yml \
  --profile operations run --rm backup
```

Local files are written under `BACKUP_DIR` and ignored by Git. Production must
copy encrypted backups to off-host object storage and alert on failures. A local
backup on the same VM is only the first stage of the backup pipeline.

## Isolated restore test

The restore test creates a temporary PostgreSQL service on a dedicated internal
network and tmpfs. It does not connect to or replace the production database.

```bash
PRODUCTION_ENV_FILE=.env.production sh scripts/production/restore-test.sh
```

To test a specific dump:

```bash
PRODUCTION_ENV_FILE=.env.production \
  sh scripts/production/restore-test.sh linoy_designs-YYYYMMDDTHHMMSSZ.dump
```

The process validates the checksum and archive, restores with
`--exit-on-error`, verifies that public tables exist and verifies completed
Prisma migrations.

## Real restore

`scripts/production/restore.sh` contains safeguards but is not invoked against
production by the deployment scripts. A real restore is a separate incident
procedure described in `docs/ROLLBACK_RUNBOOK.md`; it requires stopped writers,
explicit target confirmation and owner approval.

## Suggested production retention

- seven daily logical backups
- four weekly copies in object storage
- periodic block-volume backup as a second recovery layer
- weekly automated restore test
- documented quarterly restore exercise

Retention must be adjusted to database size, recovery objectives and storage
cost. WAL archiving/PITR is a later availability stage and is not claimed by
this local stack.
