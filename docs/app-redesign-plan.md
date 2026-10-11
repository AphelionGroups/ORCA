# ORCA app refresh implementation plan

Reference: ../ORCA-Land/main/docs/11-orca-app-redesign-agent-brief.md and landing global.css, landing.css, WorkspacePreview.astro, content.ts.

## Inventory and baseline
SolidJS, vanilla CSS, lucide-solid. Shared index.css owns legacy Obsidian colors; inline styles repeat saturated colors and glass surfaces. Theme service persists light/dark/system. Shell has 256px sidebar and project navigation tree. Screens: login/register, project directory, Docs & Plans, board gallery/canvas, tasks kanban/list, inbox, calendar. Overlays: spaces/projects/tasks, quick capture, profile, inbox conversion, scheduling.
Safe fixtures in scripts/frontend-smoke.cjs provide baseline screenshots; no personal data or backend writes.

## Implementation sequence
1. Central semantic Snow/Polar/Mint tokens, matte primitives, typography, readable control borders and focus; light default only for new preferences. Verify build and browser baseline.
2. Shell and Project Hub reference: retain IA, sidebar tree and tabs; drawer on mobile with keyboard dismissal/focus return; wrap contextual actions. Verify 360/768/1024/1440.
3. Apply to auth, documents, board, tasks, calendar, inbox and settings. Retain content colors explicitly selected by users. Add named responsive layouts instead of fixed widths.
4. Verify theme persistence, keyboard/dialog focus, reduced motion, fixture navigation and stale response regression. Save screenshots and design-system guide; rebuild local web preview.

## Risks and boundaries
No backend/API/model/auth/storage changes. Existing calendar includes static sprint/year labels and navigation controls without handlers; record as pre-existing behavior, do not fabricate functionality. Document save remains explicit/blur-triggered, not invented autosave. Canvas intentional panning and kanban horizontal scrolling remain. Inline content/user colors must not be overwritten with global CSS. Existing preferences remain honored. Focus/labels and responsive layout may require small UI-only behavior adjustments.

## Checks
npm test, npm run build, existing frontend smoke; safe-fixture viewport screenshots and no main document overflow. Browser checks cover auth, project navigation, tabs, editor, tasks, board, inbox, calendar, profile, quick capture and drawer. Conventional commits per verified section on design/orca-app-refresh.
