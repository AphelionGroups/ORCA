# ORCA redesign implementation — 10 October 2026

Target: main at d3ad92d, retaining two existing local commits ahead of origin/main. Hosted Go/PostgreSQL + SolidJS/Vite/CSS application; demo branch is separate and is not a source of authentication or storage behavior.

Reference: ORCA-Land/main source (global, landing, motion, pointer lifecycle, Spaces Explorer, InteractiveDemo, HeroBackground, design brief and memorable-interactions handoff), plus the supplied revised brief. System fonts, Snow/Polar/Mint, matte surfaces, compact controls and limited directional wash. No wave simulation in the workspace.

## Inventory and baseline

- Auth: login/register, validation, error/loading; API token verification retained.
- Shell: sidebar, Space/project tree, quick capture, account/profile/password settings, theme light/dark/system.
- Projects: overview, CRUD dialogs, selected Project Hub, docs/board/tasks tabs.
- Docs: plaintext editor with existing preview/save controls. No editor replacement.
- Board: gallery, cards/sticky/text/image/shape, connections, selection, drag/pan/zoom and existing history. No coordinate transforms for decorative hover.
- Tasks: list and four-column Kanban, CRUD and completion/status updates.
- Calendar: existing fixed example week with create-event form/backlog. Navigation/view labels are not a fully implemented date engine on this checkout; do not introduce new calendar features in a visual redesign.
- Inbox: capture, edit/archive/delete, convert to task/document.
- Overlays: profile, quick capture, Space/project/task/event forms, board menus and toolbars.

Baseline screenshots use an isolated browser and synthetic API fixture, never production data. Local API at 8080 is unavailable and Docker engine is stopped at audit time; live backend/database integration remains unverified unless recovered. Landing preview on 4321 is reachable. Existing routing is signal-based; no URL/deep-link/back-forward contract exists to silently replace.

## Implementation sequence

1. Record screenshots and preserve current main. Commit audit/plan.
2. Replace palette with semantic theme tokens and compatibility aliases for existing CSS. Keep dark/system persistence. Align typography/surfaces/forms/headers/editor/card density.
3. Add shared control wash with per-control listeners, one queued frame, disabled checks and lifecycle cleanup. CSS focus, active and reduced-motion feedback; no animation dependency.
4. Make shell responsive with mobile drawer/focus return; add real keyboard tabs, preserve API/state. Normalize dialogs and accessible interaction targets.
5. Check all modules, remove conflicting inline visual styles, retain rendering/editor behavior. Document pre-existing product limitations.
6. Run build/unit/frontend smoke and broad browser fixture QA across 360/768/1024/1440, themes, reduced-motion runtime changes, keyboard/focus and 200% zoom. Save before/after artifacts and measured contrast/performance observations. Commit verified stages on main as explicitly requested; no push, deployment or production writes.

Risks: inline fixed sizes/colours override theme; board transforms are coordinate-sensitive; stacked overlays require top-dialog focus; hidden tabs must not steal focus; fixture tests verify frontend behavior rather than actual backend persistence. Calendar and some routing limitations predate redesign. Keep these separate from styling fixes.

## Completion

Implemented and verified on main. The archive of d3ad92d supplies reproducible baseline screenshots. Production build, request-gate tests, Go tests, frontend smoke, four-viewport browser regressions and 50 semantic contrast pairs pass. The document save/typing race discovered during QA was fixed without changing its endpoint/schema. See [handoff](redesign-handoff-2026-10-10.md) for evidence, preview setup, commits and remaining calendar/routing/live-backend limits; see [system guide](redesign-system-2026-10-10.md) for tokens and interaction lifecycle.
