# ADR 0006: Tablet Stylus & Pen Input Architecture for Visual Brainstorming

## Status
Accepted

## Date
2026-09-16

## Context
Visual brainstorming and rapid ideation on tablet hardware (e.g., iPad with Apple Pencil or Samsung Galaxy Tab with S-Pen) heavily benefit from freehand sketching and digital handwriting.
Standard HTML DOM elements (`div`) cannot naturally render smooth calligraphic brush strokes. A dedicated technical strategy is required to support stylus inking without compromising the high-performance Spatial DOM card architecture established in ADR 0002.

## Decision
We establish the following technical design for stylus/pen input (scheduled for **v0.2**):
1. **Layered Hybrid Canvas Overlay:**
   - Overlay a transparent SVG/canvas drawing layer directly across the Spatial DOM canvas.
   - Leverage standard browser `PointerEvent` APIs (`e.pointerType === 'pen'` and `e.pressure`) to differentiate stylus interaction from finger touch.
2. **Vector Inking via `perfect-freehand`:**
   - Integrate the framework-agnostic `perfect-freehand` library.
   - Transform raw input streams `[x, y, pressure]` into organic Bézier curves rendered directly as SVG vector paths (`<path d="..." />`).
3. **Gesture Differentiation & Palm Rejection:**
   - Enforce CSS `touch-action: none` across the canvas drawing surface.
   - Stylus input triggers inking strokes immediately.
   - Dual-finger touch gestures handle viewport transformations (pan and pinch-to-zoom). Wide contact areas (palms) are rejected based on pointer radius and contact metrics.
4. **Vector Storage via JSONB:**
   - Freehand strokes persist as structured coordinate paths within PostgreSQL `JSONB` columns rather than rasterized bitmaps (PNG/JPEG), ensuring compact storage and infinite scalability without pixelation.

## Consequences
- **Positive:**
  - Preserves SolidJS architecture without pulling in heavy external whiteboard dependencies.
  - Capable of achieving high-refresh-rate inking (up to 120Hz ProMotion on supported tablets).
  - Vectorized stroke paths can be ingested by future AI/OCR summarization pipelines.
- **Negative:**
  - Requires meticulous cross-platform pointer gesture handling to prevent conflicts with native browser viewport scrolling.
