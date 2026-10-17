# Canvas touch interaction

Canvas uses Pointer Events for mouse, touch and pen. The stable canvas captures
the active pointer because optimistic object updates can replace the object DOM.

- Tap an object to select it; drag it with one finger to move it.
- Drag a corner to resize. Touch hit areas remain 44 CSS pixels across zoom levels.
- Drag empty space to pan. Use two fingers to pan and pinch to zoom.
- Adding a second finger cancels the in-progress object draft before navigation.
  Lift both fingers before starting another object gesture.
- Use Edit and Done editing on mobile. Desktop double-click still opens editing.
- Locked objects can be selected but cannot be dragged, resized or edited.

Movement below 8 screen pixels for touch/pen (3 for mouse) does not change an
object. Completed drag/resize gestures use one existing board operation, so one
undo reverses the gesture. Pointer cancellation, lost capture, window blur or
leaving the board discard draft geometry. Failed saves show an error and reload
the confirmed board graph. No database schema changes are needed.

## Validation

`npm --prefix web run build` and `npm --prefix web test` validate the frontend.
`node scripts/frontend-smoke.cjs` includes Chromium touch input through CDP:
drag, resize, undo/redo, cancellation, tap tolerance, locked objects, one-finger
pan, pinch transition, toolbar bounds, text editing, desktop double-click and a
failed-save recovery. API requests use an isolated fixture; no user data changes.
Set `ORCA_PLAYWRIGHT_MODULE` to an installed Playwright package if necessary.

The demo additionally checks localStorage persistence after touch drag/resize and
reload, iframe rendering, reset and blocked-storage recovery through
`scripts/demo-ui-check.cjs`.

Physical Android Chrome and iPhone Safari testing is still required for keyboard
occlusion, native text selection and device-specific gesture cancellation. Browser
touch emulation does not establish physical-device compatibility.
