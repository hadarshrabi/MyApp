# Application rollback runbook

Rollback is performed by immutable application digest. It does not automatically
reverse a Prisma migration.

## Preconditions

- The previous application digest is known and passed CI/security scanning.
- The previous application is compatible with the current database schema.
- A pre-migration backup exists and its checksum passed.
- The incident and current image digest have been recorded.

## Application rollback

Set `ROLLBACK_APP_IMAGE` to the previous `ghcr.io/...@sha256:...` value, then:

```bash
PRODUCTION_ENV_FILE=.env.production \
ROLLBACK_APP_IMAGE='ghcr.io/hadarshrabi/myapp-app@sha256:PREVIOUS_DIGEST' \
sh scripts/production/rollback.sh
```

The script pulls that exact digest, recreates only the application service and
requires readiness to pass. PostgreSQL and its volume are not replaced.

After rollback verify:

```bash
curl --insecure --fail https://localhost:8443/api/health/live
curl --insecure --fail https://localhost:8443/api/health/ready
curl --insecure --fail https://localhost:8443/
```

Also verify login and one representative read/write workflow before closing the
incident.

## Database rollback policy

Do not run an automatic down migration. Prefer forward repair or an application
version compatible with both schemas. Restoring a database backup is a separate,
destructive incident operation because it discards writes made after the backup.

A real database restore requires all of the following:

1. Maintenance mode or stopped application writers.
2. Explicit target database and `RESTORE_CONFIRM_DATABASE` match.
3. Selected backup checksum validation.
4. Approval from the system owner.
5. Restore into a temporary database and verification first.
6. A documented recovery point and accepted data-loss window.

The repository's automated restore test never targets the production database.
