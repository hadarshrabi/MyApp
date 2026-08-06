# Local Docker development

This setup runs the production-shaped application locally: one Node/Express
container serves both the built React client and the REST API, and one
PostgreSQL container stores the data.

## First run

1. Copy `.env.example` to `.env`.
2. Replace `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
   `SEED_ADMIN_PASSWORD`, and `SEED_EMPLOYEE_PASSWORD` with local values.
   `JWT_ACCESS_SECRET` must contain at least 32 characters.
3. Keep the password in `DATABASE_URL` synchronized with
   `POSTGRES_PASSWORD` when running Prisma directly from the host. If the
   password contains URL-reserved characters, URL-encode it in
   `DATABASE_URL`.
4. Start the complete stack:

```bash
docker compose up --build
```

The application is available at `http://localhost:3001` by default. Compose
waits for PostgreSQL's `pg_isready` health check, runs the one-off `migration`
service, and starts `app` only after migrations exit successfully.

Inspect the state with:

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f postgres
```

The liveness endpoint is `GET /api/health/live`; it checks only that Express is
responding. The readiness endpoint is `GET /api/health/ready`; it returns HTTP
200 only when Express can query PostgreSQL, and HTTP 503 when the database is
not available. `/api/health` remains a compatibility alias for readiness.

## Migrations

Committed migrations are applied by the one-off `migration` service during
`docker compose up`. The long-running application image contains neither the
Prisma CLI nor migration files. `prisma migrate deploy` applies pending
migrations only; it does not create a new migration from schema changes.

When developing a new schema migration, use the host development workflow
against the local PostgreSQL port:

```bash
npm run db:migrate
```

Review and commit the generated directory under `prisma/migrations`. Restarting
the application container then verifies that the committed migration can be
deployed by the runtime command.

To apply committed migrations manually without starting the long-running app:

```bash
docker compose run --rm migration npx prisma migrate deploy
```

## Seed data

Seed is deliberately not automatic. Automatic seed on every startup can reset
credentials or make application startup non-deterministic. After setting all
`SEED_*` variables in `.env`, run it explicitly:

```bash
docker compose run --rm migration npx prisma db seed
```

Seed is intended only for an isolated development database, never for
production.

## Stopping and resetting

Stop containers while preserving the database:

```bash
docker compose down
```

`docker compose down -v` also deletes the PostgreSQL named volume and all local
database data. Use it only when an intentional clean reset is required.

## Development and production Compose structure

The repository currently has one local `docker-compose.yml`. It publishes both
services only on `127.0.0.1`, builds the application locally, and permits local
seed variables.

A later production setup should use a separate override or deployment file,
for example:

```text
compose.yaml                 shared service definitions
compose.dev.yaml             build, host ports, local PostgreSQL, seed values
compose.prod.yaml            immutable image tag, no DB host port, secrets,
                             resource policy and production ingress network
```

Production should not copy the local database password defaults. It should use
an externally supplied `DATABASE_URL`, a secret manager, an immutable
application image, a private managed PostgreSQL service, and a dedicated
one-off migration job. Those production changes are intentionally outside the
scope of this local Docker phase.
