# Production deployment runbook

This runbook deploys the existing React/Express monolith, PostgreSQL and Caddy
with Docker Compose. It does not create cloud resources and does not run seed.

## Required files

1. Copy `.env.production.example` to `.env.production` outside version control.
2. Replace every `CHANGE_ME` value.
3. Keep application and migration images pinned with `@sha256:`.
4. Restrict the environment file to the deployment user (`chmod 600`).
5. Create the backup directory and restrict access to the deployment user.

Validate the rendered configuration without printing it into build logs:

```bash
docker compose --env-file .env.production -f compose.production.yml config --quiet
```

## Initial local validation

`localhost` causes Caddy to use its local certificate authority. The certificate
is intentionally not trusted by the host during this validation, so probes use
`curl --insecure`. A real DNS name activates publicly trusted automatic HTTPS.

```bash
docker compose --env-file .env.production -f compose.production.yml up -d --wait postgres
PRODUCTION_ENV_FILE=.env.production sh scripts/production/migrate.sh
docker compose --env-file .env.production -f compose.production.yml up -d --wait app caddy

curl --insecure --fail https://localhost:8443/api/health/live
curl --insecure --fail https://localhost:8443/api/health/ready
curl --insecure --fail https://localhost:8443/
```

PostgreSQL has no published host port. Confirm with:

```bash
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml port postgres 5432
```

The second command must not return a host binding.

## Normal deployment

1. Record the currently running application digest as `ROLLBACK_APP_IMAGE`.
2. Set the new `APP_IMAGE` and matching `MIGRATION_IMAGE` digests.
3. Validate Compose.
4. Pull both immutable images.
5. Start and health-check PostgreSQL.
6. Create and validate a database backup.
7. Run the migration image once.
8. Only after migration succeeds, update application and Caddy.
9. Verify liveness, readiness and the React document.

The automated form is:

```bash
PRODUCTION_ENV_FILE=.env.production sh scripts/production/deploy.sh
```

If backup or migration fails, the script exits before replacing the application.

## Graceful shutdown verification

```bash
docker compose --env-file .env.production -f compose.production.yml kill --signal SIGTERM app
docker compose --env-file .env.production -f compose.production.yml logs app
```

The log must contain `Graceful shutdown completed`. Because the service has
`restart: unless-stopped`, use `docker compose stop app` when an automatic
restart is not desired.

## Persistence verification

Create or identify a durable database record through the application, record its
identifier, then restart containers without deleting volumes:

```bash
docker compose --env-file .env.production -f compose.production.yml restart postgres app
curl --insecure --fail https://localhost:8443/api/health/ready
```

Verify the same record still exists. Never use `docker compose down --volumes`
on production data.

## Operations

```bash
# Status
docker compose --env-file .env.production -f compose.production.yml ps

# Logs
docker compose --env-file .env.production -f compose.production.yml logs --tail 200 app caddy postgres

# One-shot migration (includes a backup)
PRODUCTION_ENV_FILE=.env.production sh scripts/production/migrate.sh

# One-shot backup
docker compose --env-file .env.production -f compose.production.yml --profile operations run --rm backup

# Isolated restore test
PRODUCTION_ENV_FILE=.env.production sh scripts/production/restore-test.sh
```

## Stop without deleting data

```bash
docker compose --env-file .env.production -f compose.production.yml stop
```

Do not use `down --volumes`. Removing `postgres_data` is a destructive database
operation and is outside the deployment procedure.
