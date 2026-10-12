# ORCA redesign handoff — 10 October 2026

Redesign is implemented on **main**. The starting checkout was `d3ad92d`, already two commits ahead of `origin/main`; both existing commits were preserved. No landing files, API contracts, database migrations or dependency manifests changed.

## Delivered screens and behavior

- Login/registration: matte form, clear fields, Polar CTA, validation/error/loading, password visibility and keyboard tabs.
- Shell: Snow sidebar, ORCA wordmark, real route/project selection, keyboard-accessible Space/project navigation, theme persistence and mobile drawer.
- Project overview/Hub: white cards, readable metadata, restrained Mint detail, direction badge and keyboard project tabs.
- Documents: white editor, wrapping toolbar, readable typography, keyboard-reachable import and save-error recovery. Pending responses retain the newer draft.
- Board: neutral canvas, matte gallery, named tools, working drag/undo/zoom and accessible shape menu. Popovers remain outside the scrolling toolbar.
- Tasks: matte Kanban/list controls, keyboard card editing, existing CRUD/status flow and scroll affordance.
- Calendar: consistent grid/backlog/form surfaces and real create-event loading/error feedback. Hardcoded example event cards and the fake “Live”/current-time line were removed.
- Inbox/Quick Capture: consistent capture surface, conversion form, focus management, existing save shortcuts and empty states.
- Account settings: matte profile/password form, upload controls, keyboard tabs and focus return.

The existing mixed Indonesian/English UI was retained; the safe QA content uses English names and long labels. Authentication is active on main. The independent localStorage demo implementation was not merged.

## Validation

| Check | Result / practical scope |
| --- | --- |
| `npm run build` | Pass: TypeScript and Vite production build |
| `npm test` | Pass: 2 request-gate regressions |
| `go test ./...` | Pass; backend files unchanged, cached results; not evidence of live database integration |
| `node scripts/frontend-smoke.cjs` | Pass: authenticated shell, docs/tasks/canvas, project switches and delayed stale responses |
| `node scripts/redesign-ui-check.cjs` | Pass in Chromium 151.0.7922.34, using intercepted synthetic API responses |
| `node scripts/redesign-contrast.cjs` | Pass: 54 semantic colour pairs, including maximum hover compositing and control/focus boundaries |
| `git diff --check` | Pass |

Browser coverage includes 360/768/1024/1440px; light/dark persistence; runtime reduced-motion reset; stable hover bounds; touch drawer/inert background; Tab/Escape/focus return; repeated dialog mount/unmount with listener-count checks; keyboard tabs; shape menu on touch and 200% zoom; clipped-action assertions for document Save and header actions.

Functional checks use the real frontend and assert fixture API writes: login/registration validation and pending submit, 401 token clearing/logout, Space/project creation, document title/content save and reload, delayed title-save/typing race, failed save/retry, task creation/status update, board drag persistence/undo/zoom/reset, capture shortcut, Inbox conversion, and profile update. Empty and populated workspaces are also captured. No production data or database writes were used for QA.

### Measurements

The final fixture run dispatched 12 editor input events in a populated workspace (24 extra long-title projects and 80 extra tasks). Time from dispatch to the second animation frame ranged **21.9–34.5ms**, maximum 34.5ms. These local observations include intentional frame waiting; they are **not INP, Core Web Vitals or production performance claims**. Raw samples are in the after manifest.

Comparable Vite output with the same recovered local dependencies:

| Asset | Baseline gzip | Redesign gzip |
| --- | --- | --- |
| Application JS | 64.13 kB | 65.86 kB |
| CSS | 7.54 kB | 10.78 kB |

No runtime package was added. External Google font requests were removed. Semantic contrast measurement is not a full accessibility certification; user-selected canvas/Space colours still rely on the existing contrast treatment and were not exhaustively enumerated.

## Before/after evidence

Baseline screenshots were built from an immutable `git archive` of `d3ad92d`. Both phases use synthetic API fixtures and matching viewports; the baseline still shows any legacy static content rendered by that source. All files are under `screenshots/redesign-2026-10-10/`.

| View | Before | After |
| --- | --- | --- |
| Login, desktop | [before](screenshots/redesign-2026-10-10/before/login-1440.png) | [after](screenshots/redesign-2026-10-10/after/login-1440.png) |
| Projects, desktop | [before](screenshots/redesign-2026-10-10/before/projects-1440.png) | [after](screenshots/redesign-2026-10-10/after/projects-1440.png) |
| Documents, mobile | [before](screenshots/redesign-2026-10-10/before/documents-360.png) | [after](screenshots/redesign-2026-10-10/after/documents-360.png) |
| Board gallery | [before](screenshots/redesign-2026-10-10/before/board-gallery-1440.png) | [after](screenshots/redesign-2026-10-10/after/board-gallery-1440.png) |
| Board canvas | [before](screenshots/redesign-2026-10-10/before/board-1440.png) | [after](screenshots/redesign-2026-10-10/after/board-1440.png) |
| Tasks | [before](screenshots/redesign-2026-10-10/before/tasks-1440.png) | [after](screenshots/redesign-2026-10-10/after/tasks-1440.png) |
| Calendar | [before](screenshots/redesign-2026-10-10/before/calendar-1440.png) | [after](screenshots/redesign-2026-10-10/after/calendar-1440.png) |
| Inbox | [before](screenshots/redesign-2026-10-10/before/inbox-1440.png) | [after](screenshots/redesign-2026-10-10/after/inbox-1440.png) |

Additional evidence includes [drawer](screenshots/redesign-2026-10-10/after/drawer-360.png), [settings](screenshots/redesign-2026-10-10/after/settings-1440.png), [capture](screenshots/redesign-2026-10-10/after/capture-360.png), [dark mobile](screenshots/redesign-2026-10-10/after/dark-360.png), [200% zoom](screenshots/redesign-2026-10-10/after/zoom-200.png), [zoomed menu](screenshots/redesign-2026-10-10/after/zoom-board-menu-200.png), document/auth/registration errors, dense/empty states and CRUD dialogs.

[Before manifest](screenshots/redesign-2026-10-10/before/manifest.json), [after manifest](screenshots/redesign-2026-10-10/after/manifest.json), [contrast measurements](screenshots/redesign-2026-10-10/contrast.json).

## Trying it locally

Frontend preview is running at **http://127.0.0.1:3014/**. It is the hosted main application and opens the real login screen.

For a fresh checkout:

```sh
cd web
npm ci
npm run dev -- --host 127.0.0.1 --port 3014 --strictPort
```

Start the existing local API/database setup to log in and verify real persistence. The API at port 8080 was unavailable and Docker engine was stopped during this task, so authenticated browser QA used isolated API interception. No environment credentials were changed. Local dependency installation encountered slow extraction and unsupported filesystem links; the downloaded packages were recovered into ignored node_modules without changing package.json/package-lock.json. Build/test/dev commands work in the current checkout.

For repeatable frontend QA, install Playwright in your tooling environment or set `ORCA_PLAYWRIGHT_MODULE` to its module path, then run from repository root:

```sh
node scripts/frontend-smoke.cjs
node scripts/redesign-ui-check.cjs
node scripts/redesign-contrast.cjs
```

`ORCA_QA_PHASE=before` and `ORCA_QA_DIST=/path/to/baseline/dist` capture a separately built baseline. The default runs the current `web/dist`. Fixtures are test-only and do not create an authentication bypass in the app.

## Open limits inherited from main

1. **Live database, authorization and uploads:** frontend calls remain intact, but actual SQL persistence, tenant enforcement, password changes and image upload/storage need verification with the local backend running. Fixture profile/CRUD responses cannot prove them.
2. **Calendar date engine:** this checkout uses a fixed weekday matrix. Date navigation/view buttons do not implement a complete date engine, events are positioned by the legacy layout, and the fixed Wednesday “Today” label/date offsets remain inaccurate. These existing product bugs need a separate functional calendar change; create-event payload/UI alone was tested here.
3. **Routing:** navigation is signal-based; URL/deep-link/back-forward state is not implemented by this checkout. No replacement router was introduced.
4. **Board history/relations:** drag, move undo and zoom were checked. Delete/restore IDs, relation persistence, complex resize/touch gestures and collaborative conflicts are outside the verified cases. The existing controller can derive default relations; this redesign does not claim a new relation storage model.
5. **Language/accessibility scope:** no localization subsystem exists to switch the whole UI. Semantic contrast, targeted keyboard flows and screenshots were checked; full assistive-technology/browser-matrix audits remain separate work.

## Commits

- `362d4d8` — implementation inventory, plan and supplied brief.
- `f852698` — theme tokens, matte controls, shared motion/focus/tab foundation.
- `aa8b9c7` — responsive shell, accessible project navigation and module redesign.
- `182ced1` — document editor and draft/save integrity plus browser/contrast regressions.
- Final documentation commit — this handoff, system guide and screenshots.

Commits are local on main; no push or deployment was performed. [System guide](redesign-system-2026-10-10.md) and [implementation inventory/plan](redesign-implementation-2026-10-10.md) describe the implementation boundaries.
