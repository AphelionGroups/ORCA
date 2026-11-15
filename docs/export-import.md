# Portable ORCA packages

Export and import use a versioned `.orca.zip` archive. Import always makes a copy;
it never merges or overwrites existing work. The UI provides a file preview,
destination selection, actual upload progress, validation errors, retry and a
link to open the imported project/Space.

## Entry points

- Home page options: workspace export and package import.
- Profile settings, Data workspace: workspace export/import.
- Project page options: selected project or Space export, plus import. An open
  canvas exports the current board.
- Space, Project and Task detail dialogs: Export.
- Board gallery actions: export the individual board.

Workspace/Space packages create new Spaces. Project packages are copied into an
existing Space. Board and Task packages accept a destination Space/project. The
UI requires a project for Board packages because the current board browser lives
inside projects. A Task package contains its descendants and linked sessions;
exporting an individual child makes it independent of its outside parent.

## Format version 1

`manifest.json` contains `format: "orca"`, `version: 1`, name, export timestamp,
scope, a typed entity inventory, attachment inventory and warnings. `assets/`
contains referenced images. Every asset has its original URL, sniffed MIME type
and SHA-256 digest. Currently supported image formats match the upload API:
JPEG, PNG, GIF and WebP. External images remain URLs; they are never fetched by
the server. Missing owned attachments fail export instead of silently producing
an incomplete backup.

Scopes:

| Scope | Contents |
| --- | --- |
| Workspace | All active Spaces, projects, documents, boards, tasks, events, Inbox notes and internal links |
| Space | The Space, its projects/content, and linked task sessions |
| Project | Project, documents, boards, tasks/children and linked sessions |
| Board | Board viewport, blocks, geometry, content, connectors and referenced images |
| Task | Task, descendants and linked Calendar sessions |

Accounts, passwords, tokens, server configuration, deleted records, board operation
history, user preferences and browser-local dashboard layouts are excluded.
External-provider Calendar identifiers are excluded so copies cannot accidentally
update an upstream calendar. The copy has new entity IDs and creation/update times.
Task dates, priorities, statuses and automation ownership are preserved.

Only whitelisted columns and tables can enter the database. Internal IDs are
mapped to new IDs, including structured and text content references. Links whose
endpoint falls outside the scope are omitted with an explicit warning; available
titles are retained as plain text on the included content. Imported Space slugs
are unique and root names are suffixed `(Salinan)`.

The archive is limited to 128 MB compressed, 256 MB expanded, a 16 MB manifest,
20,000 entities, 500 attachments and 10 MB per attachment. Export currently reads
a bounded consistent workspace snapshot, so the workspace data limit applies to
narrow exports as well. Images do not count toward that JSON data limit. ZIP
paths, duplicate entries, unknown versions/fields, hashes, MIME types, references,
task cycles and Calendar intervals are validated before import.

## API

All endpoints use the existing authenticated workspace boundary:

- `GET /api/v1/transfer/export?kind=workspace|space|project|board|task&id=UUID`
  returns an attachment ZIP. `id` is omitted for workspace export.
- `POST /api/v1/transfer/preview`, multipart `file`, returns counts, scope,
  warnings and whether a destination is required. It writes no database records.
- `POST /api/v1/transfer/import`, multipart `file`, `request_id` (UUID),
  optional `space_id`/`project_id`, returns imported counts and new IDs.

Migration 000008 stores workspace-scoped import receipts. Repeating the same
request ID/package/destination returns the original result, including concurrent
retries. Reusing a request ID for different content/destinations returns 409.
A new deliberate import uses a new request ID and produces another copy.

## Atomicity and storage

Import checks the destination inside a transaction, stages new uniquely named
images, inserts all records and commits a receipt atomically. Task mutations use
the existing workspace advisory lock. A transaction-local import flag lets a
validated legacy task hierarchy be copied and prevents automation from modifying
the saved task statuses while records are inserted. Normal task operations retain
their one-level rules after the transaction finishes.

Known failures roll back records and delete staged assets. Cleanup failures are
logged with object keys. If the database connection drops during commit, the
outcome can be uncertain: staged files are retained so a committed copy remains
usable, and retrying the same intent retrieves its receipt. Object storage and
PostgreSQL do not share a distributed transaction.

Local storage reads are constrained to the workspace and storage directory,
including symlink resolution. S3 reads use only the configured bucket and owned
object keys. No URL from the archive triggers an outbound HTTP fetch.

## Verification

- `go test ./...` with `ORCA_TEST_DATABASE_URL`: unique temporary schemas test
  every export scope across workspaces, assets, connectors, subtask dates and
  statuses, external references, replay, concurrent retry and rollback cleanup.
- Transfer/storage unit tests cover malformed ZIP paths, versions, fields,
  references, types and ownership.
- `npm --prefix web run build`, `npm --prefix web test`,
  `npm --prefix web run check:spacing`.
- `node scripts/transfer-check.cjs` with Playwright available, optionally through
  `ORCA_PLAYWRIGHT_MODULE`: synthetic UI fixtures cover download, preview,
  invalid format, destinations, replay identity, duplicate-submit protection and
  320/390/768/1440 px layouts. Screenshots: ignored `bin/transfer/`.
