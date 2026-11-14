# Spacing in the ORCA app

Reference: [Principles of Spacing in UI Design: the 4-Point Spacing System](https://uxplanet.org/principles-of-spacing-in-ui-design-a-beginners-guide-to-the-4-point-spacing-system-6e88233b527a).

Use spacing to group related controls and distinguish sections. The base unit is 4 CSS pixels. A larger gap should indicate a different relationship, rather than simply making the interface roomier.

## Scale and roles

`web/src/styles/theme.css` defines `--space-1` through `--space-24`, in multiples of 4. Zero needs no token. The named layout roles are:

| Relationship | Value |
| --- | --- |
| Closely related marks or compact controls | 4 px |
| Label to field, icon to label, adjacent actions | 8 px |
| Content inside compact groups | 12 px |
| Between form fields or medium groups | 16 px |
| Panel interiors | 20 px desktop, 16 px mobile |
| Page inset and section gap | 24 px desktop, 16 px mobile |
| Major separation | 32 px |

`web/src/styles/spacing.css` applies shared roles to the shell, pages, sidebar, dashboard, Calendar, document editor, task views, dialogs and canvas controls. Individual components can use another scale step where their density requires it. Related content stays closer than separate sections.

Modal cards use 24 px on desktop and 20 px on mobile. The profile dialog has separate full-width header/body regions, each with its own inset, so its outer shell has no additional padding. Form fields use 16 px separation; labels use 8 px. Primary page content shares a common inset.

## What the scale does not change

Borders, focus outlines, typography, icon dimensions, chart/connector geometry, saved canvas coordinates and dimensions, pointer offsets, calendar minute-to-pixel calculations, and widget sizing have separate purposes. Do not round them to spacing tokens. Keep accessible touch target sizes and intentional internal scrolling. Negative or derived offsets require contextual review.

## Verification

The initial source audit found 325 positive pixel spacing occurrences outside the scale. CSS declaration parsing and TypeScript syntax traversal were used to normalize padding, margin and gap literals without rewriting geometry or string content.

- `npm --prefix web run check:spacing` checks CSS and TSX layout declarations.
- `node scripts/spacing-check.cjs` renders pages and dialogs at 320, 390, 768, 1024 and 1440 px; checks computed container padding/gaps, overflow, dark theme and 200% zoom. Set `ORCA_PLAYWRIGHT_MODULE` if Playwright is installed elsewhere.
- Baseline and result images/metrics are stored under ignored `bin/spacing-before` and `bin/spacing-after`.
- Interaction regression checks remain necessary for canvas controls, modals, Calendar planning and dashboard resizing.

Scope is the main app checkout. Demo and landing page styling are separate.
