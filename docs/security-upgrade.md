# Security and deployment upgrade

ORCA registers each new account as the owner of a new workspace. Registration never grants access to an existing workspace. Invitations and shared-workspace membership are not implemented. Set `ALLOW_REGISTRATION=false` after provisioning accounts for a private installation.

## Production configuration

- Set a unique `JWT_SECRET` containing at least 32 random bytes. Empty, short, and historical default secrets stop production startup. Rotating it signs out existing sessions.
- Set `ENV=production` and `ALLOW_DEV_WORKSPACE_HEADER=false`. The legacy workspace-header bypass is opt-in and development-only.
- The API uses the tenant signed into the JWT. An optional `X-Workspace-ID` must match; malformed values return 400 and a different tenant returns 403. Frontend requests no longer send the demo tenant header.
- Login and registration share a limit of 30 attempts per connection IP per minute. Forwarded IP headers are not trusted. Behind Nginx, users share the proxy connection IP limit; configure additional per-client limits at the trusted edge when scaling. Limits reset when the API restarts.
- Fresh production schemas contain no demo users. Development seed data is explicit in `scripts/seed_demo.sql`. Existing demo users are preserved: change or disable their credentials before exposing an upgraded installation.

Generate a secret locally, for example with PowerShell:

```powershell
$secretBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
[Convert]::ToBase64String($secretBytes)
```

Store the generated value in `.env`; do not commit it. Start production explicitly with `docker compose -f compose.yml up -d --build` so the development override cannot enable development mode or seed data.

## Migrations and existing data

Back up the database before upgrading. `AUTO_MIGRATE=true` applies embedded migrations in filename order, records them in `schema_migrations`, and uses a transaction-scoped advisory lock to serialize concurrent startup. The complete pending migration batch is atomic. The CLI uses the same runner: `go run ./cmd/migrate`.

Migration 000002 adds composite foreign keys for tenant boundaries and project/space consistency; validates new references against active entities; rejects tenant changes; checks polymorphic links; and enforces case-insensitive email uniqueness. Existing cross-tenant foreign keys, project/space mismatches, duplicate emails, or invalid entity links cause migration failure and roll back the batch. No user records are silently deleted or reassigned. Inspect and resolve those records before retrying. Existing installations that ran the original schema without migration tracking are supported by the idempotent initial migration.

To inspect duplicate emails:

```sql
SELECT lower(email), count(*) FROM users GROUP BY lower(email) HAVING count(*) > 1;
```

To inspect project space ownership:

```sql
SELECT p.id, p.workspace_id, s.workspace_id AS space_workspace
FROM projects p JOIN spaces s ON s.id=p.space_id
WHERE p.workspace_id <> s.workspace_id;
```

Database relation violations return 400, duplicates return 409, and missing records return 404. Other internal errors are logged on the server and return a generic response.

## Uploads and health

The Compose API stores local images in `/app/uploads`, backed by the `orca_uploads` named volume. Back up this volume alongside PostgreSQL. Existing files in an old container's writable layer must be copied into the volume before replacing that container; mounting a new volume does not recover them automatically. Keep the volume when recreating services; `docker compose down -v` removes it.

Uploaded images remain public assets accessible to anyone who knows their object URL. This matches the existing image and S3 public-URL model; confidential attachments require a future signed/private download flow. Keys include a workspace UUID and a random object UUID. Nginx proxies `/uploads/`; the API disables directory indexes and sandboxes uploaded responses; the server accepts sniffed JPEG, PNG, GIF, and WebP and chooses the extension from the detected MIME type. SVG and disguised HTML are rejected to prevent executable content on the application origin. Configured S3 initialization failures stop startup instead of silently writing locally.

`/livez` checks that the API process responds. `/healthz` checks database readiness and initialized storage; database unavailability returns 503. Compose gates the web container on API readiness. Production startup refuses an unavailable database or a failed required migration. Readiness does not probe remote S3 network availability.

## Validation

```powershell
go test ./...
go vet ./...
npm --prefix web test
npm --prefix web run build
docker compose config --quiet
```

For repository/API integration tests, set `ORCA_TEST_DATABASE_URL` to a PostgreSQL 16+ **test** database and run `go test ./internal/platform/db -v`. Tests create uniquely named schemas and remove only their own schemas. They cover fresh and legacy migration, rollback on invalid legacy data, isolated registration, CRUD denial across tenants, foreign-key rejection, duplicate registration, and disabled registration. They skip explicitly when the test URL is absent.

For Docker-free SQL checks, install the optional PGlite test runtime in the ignored directory: `npm install --prefix bin/migration-check --no-audit --no-fund @electric-sql/pglite`, then run `node scripts/verify-migrations.cjs`. This runs actual PostgreSQL SQL in WASM, but does not replace pgx/network or container integration testing.

For UI smoke testing, provide Playwright and its Chromium runtime through `ORCA_PLAYWRIGHT_MODULE` (or make `playwright` resolvable), build the frontend, and run `node scripts/frontend-smoke.cjs`. It starts an ephemeral local static server and uses isolated API fixtures, exercising docs, tasks, canvas, navigation, and a delayed stale response. No existing browser session or real user data is used.

Legacy seeded smoke scripts accept `ORCA_TOKEN` for authenticated requests. To test without a token, explicitly enable `ALLOW_DEV_WORKSPACE_HEADER=true` on a local development API only.

## Frontend structure

`ProjectsView.tsx` composes typed document, board, and task panels. `views/project/useProjectController.tsx` owns the shared signals and interaction lifecycle; `canvas.tsx` contains canvas types, rendering helpers, and markdown blocks. Mutable canvas references use controller getters/setters to preserve the previous event behavior. Request gates invalidate results on newer navigation and unmount; opening an old board response cannot replace the current selection. Canvas interaction state remains shared in the controller; further decomposition can be done independently.
