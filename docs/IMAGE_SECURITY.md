# Docker image quality and security

## Current runtime image

The application uses a multi-stage build based on Node.js 22 Alpine:

- `build` installs the complete development tree and builds React, Express, and
  the generated Prisma Client.
- `runtime-deps` installs a dedicated locked manifest containing only packages
  imported by the server bundle.
- `migration` contains Prisma CLI and committed migrations and runs as a
  short-lived job.
- `runtime` contains the built client/API, minimal server dependencies, and the
  generated Prisma Client. It runs as the unprivileged `node` user.

The measured application image decreased from 269,275,746 bytes to 92,895,011
bytes. Uncompressed `node_modules` decreased from about 384 MB to about 100 MB,
and Docker Scout's indexed package count decreased from 439 to 123.

The base image is pinned by digest through the `NODE_IMAGE` build argument. The
human-readable tag documents the intended release line, while the digest makes
builds reproducible. Updating Node requires an explicit digest refresh followed
by the complete build and test suite.

## Local vulnerability scanning

Use an installed scanner against the built image. Either of these is suitable;
the project does not require both:

```bash
docker scout cves myapp-app:latest
trivy image --severity HIGH,CRITICAL myapp-app:latest
```

Scanner databases change over time, so record the scan date and database
version with results. Treat Critical findings as release blockers. Review High
findings for reachability and remediate or document a time-bounded exception.

## SBOM

Generate a CycloneDX or SPDX inventory from the final image:

```bash
docker scout sbom --format cyclonedx myapp-app:latest
syft myapp-app:latest -o cyclonedx-json
```

Store an SBOM beside the corresponding immutable image release, not as an
unversioned report. An SBOM is an inventory; it does not replace vulnerability
scanning.

## Dependency update policy

- Review `npm audit` and outdated packages at least monthly and before releases.
- Apply patch updates in small groups and run typecheck, build, route tests,
  PostgreSQL integration tests, container health checks, and shutdown tests.
- Review minor updates individually, especially Prisma, Express, Capacitor, and
  authentication libraries.
- Plan major updates as explicit changes with migration notes and rollback.
- Never run `npm audit fix --force` without reviewing every proposed version.
- Keep `package-lock.json` committed and build with `npm ci`.
- Rebuild images regularly even without application changes so that an approved
  Node/Alpine digest can receive OS security fixes.

## Runtime dependency reduction

The monorepo manifest still mixes browser, build, migration, and API packages,
but the final image no longer installs from that manifest. The dedicated
`docker/runtime` manifest is intentionally explicit and locked. Any new external
server import must also be added there or the container smoke test will fail.

Prisma CLI, npm tooling, schema, migrations, and seed data are excluded from the
long-running image. npm/yarn binaries inherited from the Node base are removed
from its final filesystem. They remain available only in build and migration
stages.

The migration job has its own locked manifest under `docker/migration`. Its
measured image size decreased from 347,849,169 bytes to 165,970,528 bytes. It is
still larger and has more tooling than the application image because Prisma CLI
is required, but it is short-lived and exposes no port.
