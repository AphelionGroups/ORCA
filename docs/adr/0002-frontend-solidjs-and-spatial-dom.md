# ADR 0002: Selection of SolidJS Frontend & Custom Spatial DOM Canvas

## Status
Accepted

## Date
2026-09-16

## Context
A core feature of ORCA is the visual brainstorming workspace (*spatial canvas*) combining long-form markdown, sticky notes, task cards, moodboard images, and relational connector arrows.
In the web ecosystem, three primary canvas architecture patterns exist:
1. **React + `tldraw`:** A popular turnkey solution, but introduces significant Virtual DOM runtime overhead. `tldraw` is oriented toward freehand vector drawing rather than structured web cards. Nesting complex HTML forms or rich text inside React canvas nodes frequently triggers expensive re-render cascades during card dragging.
2. **Pure WebGL / HTML5 Canvas (Figma pattern):** Requires building text selection, cursor handling, input boxes, and accessibility from scratch—impractical for agile development.
3. **SolidJS + Spatial DOM (Milanote pattern):** Cards are native HTML elements positioned via CSS `transform: translate3d(x, y, 0)`, paired with a transparent SVG layer rendering relational connector curves.

## Decision
We select **SolidJS + Vite (TypeScript)** for the web application, architecting the visual board as a **Custom Spatial DOM Canvas with SVG Connectors**:
1. SolidJS operates via *fine-grained reactivity* without a Virtual DOM. Component functions execute only once upon mounting; updates to `(x, y)` coordinate signals directly mutate the style properties of the target DOM element without triggering re-renders inside the card contents.
2. Cards remain native HTML `div` elements, preserving native browser spell-checking, text selection, accessibility, and interactive form controls.
3. Dynamic connector arrows are rendered reactively within an SVG overlay.

## Consequences
- **Positive:**
  - Stable 60/120 FPS performance during pan, zoom, and multi-card drag operations without re-render cascades.
  - Minimal bundle size and low client memory footprint.
  - Native HTML flexibility for card contents.
- **Negative:**
  - Requires maintaining custom viewport mechanics (pan, zoom, coordinate transformations) rather than relying on an off-the-shelf canvas library.
