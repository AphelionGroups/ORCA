# ORCA app design system

Implemented from ORCA-Land's redesign brief using the existing SolidJS, lucide-solid and vanilla CSS stack. No backend or landing changes.

## Tokens and usage
`web/src/theme.css` is the only semantic palette source; legacy aliases resolve to the same tokens. Light defaults for new preferences; existing light/dark/system choices remain persisted in `orca-theme-mode`.

| Purpose | Light value |
| --- | --- |
| Background / panel / muted surface | #F7FAF8 / #FFFFFF / #E8EEEB |
| Main / secondary text | #0D1B1E / #526560 |
| Subtle / control border | #D6E2DA / #6E8177 |
| Small accent | #B2FFA9 |
| Primary action / text / hover | #0D1B1E / #F7FAF8 / #213638 |
| Focus | #22643B; dark #B2FFA9 |
| Success / error | #287052 / #A83246 |

Mint marks active navigation and selected controls, never body copy. Polar carries primary actions. User-selected space and canvas content colors remain intact. Calendar examples and static Now/Live badges were removed; displayed appointments come from the existing API.

Segoe UI, Helvetica Neue, Arial; no downloaded font dependencies. Body/control 14px, metadata at least 12px, project titles 24–28px, document body 17px / 1.7. Spacing 4/8/12/16/24/32. Panels/dialogs 8px, controls 4px; avatars remain circular. Cards are matte without shadows; overlays alone use subtle elevation.

## Shared patterns
`index.css`: buttons, form fields, tabs, sidebar rows, profile, modal, canvas controls and named workspace layouts. Primary/secondary/destructive actions remain distinct. Focus rings are visible even on formerly outline-free editor controls. Existing disabled/loading/error/success states preserve real request behavior.

`components/focusScope.ts`: mounted dialog focus, Tab containment, Escape close, title association, existing form-label association and return to invoking control. Applied to space/project/task/profile/capture, inbox conversion and scheduling dialogs. App mobile drawer traps keyboard focus, closes with Escape/backdrop/navigation, makes underlying workspace inert and restores focus to its recreated opener. Closed sidebar is inert. Navigation and project cards are keyboard-operable; selected navigation uses aria-current and project tabs aria-selected.

At 360px: sidebar drawer, wrapped hub actions, document index stacked above editor, reachable canvas toolbar. At 768/1024px: compact header and stacked document index. At 1440px: sidebar and broad workspace. Kanban columns and calendar grid keep intentional horizontal scrolling inside named focusable regions; main document does not overflow.

## Verification (2026-10-08)
- `cd web; npm test`: 2 request-gate regressions pass.
- `cd web; npm run build`: TypeScript and Vite pass.
- `node scripts/redesign-ui-check.cjs`: safe API fixtures in headless Chromium, 360/768/1024/1440; project navigation, Docs/Tasks/Board, inbox/calendar/capture screenshots; drawer Escape and focus return, dialog focus containment, theme reload persistence and light default under a dark OS preference.
- Fixture mutation checks: edit/save document, create task and quick-capture note. Canvas opening and zoom remain functional. Existing delayed-response smoke also passes. No personal database mutations occur in these tests.
- Local screenshots in `docs/screenshots/orca-refresh` include before/after, desktop/mobile, auth, settings, canvas and dark theme. Screenshots use example identities ending in example.test.
- Calculated token contrast: Polar/Snow 16.76:1; secondary/white 6.20:1; control border/white 4.14:1; focus/Snow 6.77:1; dark secondary/panel 8.49:1; dark focus/panel 12.97:1; error/white 6.54:1. This is token verification, not a claim of complete WCAG certification.

## Existing limitations and test boundaries
Calendar navigation and Month/Day/Timeline switches already lack full date/view behavior; event grid originally placed fetched events in the middle weekday by order rather than date/time. Redesign keeps the scheduling API and date conversion unchanged, removes fabricated appointments/markers, and does not claim to fix that calendar model. Document save remains manual/on-blur; failures in some existing editor/canvas flows log to console instead of offering recovery UI. These need separate functional fixes.

Browser tests cover core flows and rendering, not exhaustive drag/resize/connector, undo history, paste/import/export, all CRUD permissions, stylus devices or every possible user color. API contracts and existing interaction handlers remain unchanged. Reduced-motion CSS disables animations; token contrast is measured, Core Web Vitals are not. No production deployment or push performed. Local web container preview is rebuilt for review.

## Reproduce
Install the project's existing frontend dependencies, build, then run scripts/redesign-ui-check.cjs with Playwright available (optionally set ORCA_PLAYWRIGHT_MODULE to its installed module path). The script serves built assets on a random localhost port and intercepts all /api/v1 requests with safe fixtures. It writes screenshots and closes its browser/server when finished.
