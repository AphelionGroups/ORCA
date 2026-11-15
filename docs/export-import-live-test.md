# Export/import live verification — 15 November 2026

Result: **PASS**, after correcting the issues found below.

This run used real ORCA API processes, PostgreSQL, storage and Chromium. The API
responses were not intercepted or replaced with fixtures. The existing app at
`localhost:3000` and its working data were not used as the test destination.

## Environment

- Local storage: API 8081, Vite 3001, isolated `orca_live_local_*` schema.
- S3 storage: API 8082, Vite 3002, isolated `orca_live_s3_*` schema.
- MinIO: native Windows source build of official release
  `RELEASE.2025-10-15T17-29-55Z`, commit `9e49d5e7a648`.
- MinIO S3 endpoint: `127.0.0.1:9000`; console: `127.0.0.1:9001`.
- Synthetic images: generated 512×512 PNG and a 1×1 GIF. Only the synthetic
  `orca-live` bucket had public object reads, to test browser image loading.
- Synthetic source/destination accounts were created through normal registration.

The official container registries rejected pulls during setup. MinIO was built
from its [official source release](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)
instead; see its [source-only distribution instructions](https://github.com/minio/minio#source-only-distribution).

## Live results

Every row below passed on **both Local and MinIO S3**.

| Check | Evidence |
| --- | --- |
| Workspace, Space, Project, Board, parent Task and standalone child Task | Exported ZIP, actual preview and import into another authenticated workspace |
| File integrity | SHA-256 of stored imported PNG matches original bytes; GIF retained in package |
| Board structure | Block positions/sizes, viewport and connector endpoint IDs preserved/remapped |
| Task structure | Parent/child relationship, dates, status, automatic completion setting and linked Calendar session preserved |
| Outside references | Warnings returned; outside task title retained as plain text |
| Intentional copy | Every entity gets a new ID; unrelated destination records are retained |
| Repeat import request | Same request ID returns the same result without extra records or objects |
| Concurrent retry | Two concurrent real requests produce one copy |
| Request ID conflict | Reusing an ID with a different package returns 409 |
| Broken input | Unsupported version, bad digest, missing asset, ZIP traversal, broken reference, task cycle and oversized expanded asset rejected by preview and import |
| Tenant boundaries | Foreign scope export and foreign destination import rejected |
| Missing source attachment | Deleting a synthetic source image makes export fail explicitly |
| Failure after file staging | Test-only database trigger rejects document insertion; records roll back and staged Local/S3 objects are deleted |
| Legacy text | Old string-based block content accepted and preserved |
| Source records | Positive export/import operations leave source records unchanged |
| Browser workflow | Real file upload, preview, destination, import, opening result and board image rendering |
| Upload progress | Intermediate percentages observed with actual Chromium upload bandwidth throttling |
| Export entry points | Home/project options, board gallery/canvas, Space/Project/Task dialogs and profile settings |
| Responsive layout | Preview checked at 320, 390, 768 and 1440 px |
| Image bounds | Imported image stays inside its saved fixed-height board block |

Cross-storage **Local → MinIO S3** and **MinIO S3 → Local** also passed. Neither
path requires the source object store when importing a complete package.

The missing-source-attachment check intentionally deletes only a synthetic test
image. The rollback test intentionally injects a failure only in its temporary
schema. Neither operation targets ordinary workspace data.

## Issues found and fixed

1. Board-only export replaced outside task references with generic text, losing
   the task title. The readable original title is now retained.
2. Transfer validation rejected legacy string block content accepted by ORCA.
   Validation now uses the existing block-content contract, including rejection
   of unsupported content schema versions.
3. Relative local image URLs reached Vite instead of the separate API. The
   development server now proxies `/uploads` to the configured API origin.
4. Transfer dialogs opened from profile settings were covered by the profile
   dialog. The transfer modal is now mounted after the other global dialogs so
   stacking and keyboard focus agree.
5. Fixed-height image blocks could render images outside their stored bounds.
   Images and captions now fit inside explicitly sized blocks; automatic-height
   blocks retain their existing behavior.

The first two cases have permanent unit/integration regressions. The live browser
script exercises the remaining cases against actual services.

## Reproduction

Requires the local development PostgreSQL service, Go, Node/web dependencies, and
Playwright. MinIO is built into ignored `bin/live-transfer/tools/` if absent.
The setup script creates only named temporary schemas and loopback test services.

```powershell
./scripts/transfer-live-env.ps1 -Action Start
$env:ORCA_TEST_DATABASE_URL='postgres://orca:orca_secret@127.0.0.1:5432/orca_db?sslmode=disable'
Get-Content bin/live-transfer/minio.env | ForEach-Object {
  $entry = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($entry[0], $entry[1], 'Process')
}
# Set ORCA_PLAYWRIGHT_MODULE if Playwright is not resolvable from this repository.
node scripts/transfer-live-check.cjs
./scripts/transfer-live-env.ps1 -Action Stop
```

The last successful report and screenshots are retained under ignored
`bin/live-transfer/`: `report.json`, `*-preview-*.png`, `*-upload-progress.png`,
`*-imported-board.png` and the downloaded package files. Test credentials stay in
an ignored environment file and are not included in the report.

## Cleanup and limits

Both test API/frontend processes and MinIO were stopped after the run. Only the
recorded temporary schemas were dropped; screenshots, reports and synthetic
storage files remain for inspection. The main app was updated with the fixes and
verified healthy on ports 3000/8080 using its original local storage directory.

This verifies ORCA's storage integration against MinIO's S3-compatible API.
AWS S3, R2 and Supabase were not contacted, and this is not a production
deployment or a test of all vendor-specific S3 behavior.
