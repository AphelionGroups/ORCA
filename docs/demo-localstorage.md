# Browser-only ORCA demo

This implementation belongs to the `demo` branch. It is a standalone static frontend. It has no login, password, token, authorization checks, API connection, PostgreSQL dependency, or Redis dependency. Production authentication code on the original branch is unchanged. No environment flag can switch the production application into this demo.

## Run locally

```powershell
cd web
npm ci
npm run dev -- --port 3010
```

For the built static app, run `npm run build` then `npm run preview -- --host 127.0.0.1 --port 3010`. The demo seeds English sample content automatically on first use. The displayed profile is Demo User / demo@user.com; it is a local editable profile, not an account, and no password is needed.

## Run with Docker

```bash
docker compose -p orca-demo -f compose.yml up -d --build
```

Only the `web` service runs. The default published port is 3010; change `WEB_PORT` if needed. No `DATABASE_URL`, `API_PORT`, `VITE_API_URL`, or `JWT_SECRET` is used by the demo frontend. Existing backend source remains in this repository but is not included in the demo image or used by the demo Compose file. Keep demo and production deployment projects and domains separate.

## Embed

```html
<iframe
  src="https://orca-demo.ocaty.com/"
  title="Try ORCA"
  style="width:100%;height:850px;border:0"
></iframe>
```

Nginx permits embedding by `https://orca.ocaty.com`, the same origin, and localhost preview origins through `frame-ancestors`. Change that allowlist in `web/nginx.conf` for another landing domain. Remove conflicting `X-Frame-Options: SAMEORIGIN` / DENY headers from the demo's upstream proxy or CDN. Production embedding settings stay separate.

If using the iframe sandbox attribute, include `allow-scripts allow-same-origin allow-modals`: the app needs a normal origin for localStorage and modal permission for confirmations, including reset. Browser third-party storage policies may still prevent saving. The app falls back to a temporary in-memory workspace and displays a notice; changes then disappear when the page reloads or closes. It does not request storage access or ask visitors to log in.

## Data and limitations

- The sample workspace includes spaces, a project, document, board cards/connectors, tasks, calendar sessions, and Inbox ideas. Events start on the visitor's first-use date in their browser timezone.
- Workspace data, local profile, preferences, and board undo receipts use `orca_demo_workspace_v1`. Theme uses `orca-demo-theme-mode`. Production token/profile storage keys are untouched.
- CRUD, Inbox conversion, board undo/redo, and viewport persistence operate locally. Validation keeps task/event relationships coherent, and failed saves do not report success.
- Reset demo in the sidebar restores sample data after confirmation. It resets only demo workspace data; the browser theme is preserved.
- Images are stored as data URLs with a 1 MB per-file cap. Storage quota failures keep existing saved data and report an error. The demo is not a file storage service.
- Data is scoped to the browser origin and, depending on browser policy, its embedding site. Different visitors have independent data. Tabs on the same origin share saved data; stale version updates are rejected. Simultaneous cross-tab writes are not a collaborative editing system.
- Reloading keeps data when localStorage is available. Existing calendar samples do not move forward each day; reset to regenerate current dates. Undo controls retain their existing session history behavior.
- No registration, password change, remote sync, realtime collaboration, or production security simulation is included. This is an interactive product preview, not a backend integration test.

## Verification

`cd web && npm test` covers persistence, stale writes, quota failure, atomic board batches, retries, consecutive undo/redo, connector restoration, Inbox conversion, lifecycle behavior, corrupted data recovery, and blocked iframe storage, alongside existing date/navigation tests.

`npm run build` checks TypeScript and produces deployable static assets. With preview running on 3012, run `node scripts/demo-ui-check.cjs` from repository root. Set `ORCA_PLAYWRIGHT_MODULE` to an installed Playwright module when it is not in normal module resolution, and optionally set `ORCA_DEMO_URL` to another preview URL. The browser check uses a fresh isolated browser, verifies no API/login requests, edits and reloads documents, toggles tasks, exercises board deletion/undo/redo, edits calendar events, captures Inbox notes, edits the local profile, resets data, and opens an iframe and a storage-blocked browser context. Screenshots are saved under ignored `bin/demo-screenshots/`.
