# ORCA hosted app design system

Implemented on `main`, based on the revised 10 October 2026 brief and ORCA-Land's global, landing and motion styles. The browser-local `demo` branch remains separate. The workspace uses SolidJS, existing CSS classes and existing API clients; no runtime dependency was added.

## Tokens

`web/src/styles/theme.css` owns the palette and semantic aliases. Existing components can continue using `--surface`, `--text-main`, `--text-muted`, `--primary` and other compatibility names. For new work, use the semantic names below. Do not hardcode branded colours in individual forms.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--background` | Snow `#F7FAF8` | Polar `#0D1B1E` | Workspace and sidebar |
| `--surface-panel` | `#FFFFFF` | `#16282B` | Editor, cards, dialogs |
| `--surface-muted` | Mist `#E8EEEB` | `#213638` | Subtle selection and grouped controls |
| `--text-primary` | Polar `#0D1B1E` | Snow `#F7FAF8` | Main text |
| `--text-secondary` | `#526560` | `#B9CCC2` | Metadata and secondary text |
| `--accent` | Mint `#B2FFA9` | Mint `#B2FFA9` | Selected details and wash |
| `--focus-ring` | Green `#22643B` | Mint `#B2FFA9` | Keyboard focus |
| `--border-subtle` | `#D6E2DA` | `#3D5149` | Dividers and cards |
| `--border-control` | `#6E8177` | `#8EA89A` | Required field/control boundaries |
| `--action-primary` | Polar | Mint | Primary action |
| `--action-primary-text` | Snow | Polar | Primary action label |
| `--status-success` | `#287052` | `#A8E5BF` | Real success feedback |
| `--status-error` | `#A83246` | `#FFA8B7` | Real validation/save errors |
| `--status-warning` | `#78521A` | `#FFE0A3` | Warning and password strength |

System font stack: Segoe UI, Helvetica Neue, Arial, sans-serif. Monospace is limited to compact metadata/shortcuts. Editor text is 17px with 1.7 line height; titles and controls keep the existing workspace density. Spacing uses 4/8/12/16/24/32px. Cards/dialogs use 8px corners and shared controls use 4px.

New installations start in light mode. Saved light/dark/system choices and the existing `orca-theme-mode` key remain effective; system mode responds to OS preference changes. The initial HTML theme prevents the wrong theme flashing before Solid mounts.

## Component mapping

| Existing primitive | Treatment |
| --- | --- |
| `.btn-primary`, `.btn-pill-white` | Solid primary action, organic wash, stable label |
| `.btn-secondary`, `.btn-pill-ghost` | Solid panel, readable boundary, quieter wash |
| Icon buttons / canvas tools | Simple tint, named controls, visible focus; no large wash |
| Inputs, textarea, selects | Solid panel, control border, label and keyboard focus |
| Project/auth/account tabs | Selected state, roving tabindex, Arrow/Home/End keys |
| Sidebar routes | Native buttons, actual selected project, Mint edge plus Mist fill |
| Project/board/task cards | Matte surfaces, border feedback, accessible open/edit actions |
| Dialogs | Existing forms with shared focus scope, Escape, Tab trap and focus return |
| Mobile sidebar | Drawer, backdrop, inert background, Escape and trigger focus return |
| Menus | Existing shape actions with directional focus, Escape and focus return |
| Toast/error/empty/loading | Existing state and real operations; no invented saved/progress state |

CSS load order is theme tokens → existing layout/canvas rules → workspace overrides → interaction rules. `workspace.css` adapts legacy inline layouts without replacing the editor or coordinate engine. Keep coordinate transforms in canvas code; never add decorative translation to canvas objects.

## Motion and pointer lifecycle

`installControlInteractions()` is installed once by App and disposed on App cleanup. It attaches to eligible controls, not document-wide pointer movement. Added controls are registered by a MutationObserver, removed controls lose their listeners, and a single queued animation frame updates the current control.

- Mouse tracking requires `(hover: hover) and (pointer: fine)` and no reduced motion. Touch uses ordinary tap/selection feedback.
- Wash starts at 75%/75%, occupies 90% of control width and uses an organic `48% 52% 58% 42%` outline. It moves only paint beneath the stable label.
- Primary opacity is .10 on light and .12 on dark. Secondary opacity is .36 on light and .28 on dark: .36 failed the dark hover contrast check, so the dark token is quieter.
- Paint/border changes use 160ms, wash transform 480ms, opacity 240ms and limited directional arrows 360ms. Easing is `cubic-bezier(.22, 1, .36, 1)`.
- Context entrance is 240ms with at most 4px displacement. It runs on context mount, rather than on keystrokes or row updates. Calendar overlays sit outside the animated content region.
- Active primary actions use a tiny 1px/.985 response. Ordinary hover does not move hit areas; gallery cards no longer lift on hover.
- Focus uses a 3px Green/Mint ring with 3px offset. Selection also uses text/weight/border, rather than Mint alone.
- Pointer leave, blur, disabling, preference changes and cleanup cancel the queued frame and clear wash coordinates. Runtime reduced motion removes motion and tracking while keeping selected/focus feedback.
- No wave simulation, global pointer loop, animation dependency or mass `will-change` was introduced.

Shape menus are portaled outside the scrolling canvas toolbar so they remain usable on small screens. Their positioning accounts for CSS zoom. Tool actions have accessible names and native titles.

## Document save integrity

Testing found a pre-existing race: a title blur response rehydrated the editor and could overwrite text entered while that request was pending. Draft hydration now follows document identity, using a memo so a same-document response cannot retrigger it. Blur and explicit saves share an ordered promise queue. Duplicate persisted payloads are skipped, stale project callbacks remain guarded, and a failed save keeps the draft with a visible retry message.

This is a frontend correction to the existing update endpoint. It does not introduce an offline store, document version schema or server collaboration protocol.

## Extending the system

Use native controls with labels and real disabled/loading state. Use the shared dialog focus scope for mounted forms, and shared tab/menu keyboard handlers for local panels. Keep fixtures in `scripts/`; never import them into app code or make authentication conditional on a demo environment flag. Retain the API authorization boundary when adding or styling screens.
