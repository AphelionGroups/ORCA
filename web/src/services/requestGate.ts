/** Tracks the lifetime of requests belonging to one view or selection. */
export function createRequestGate() {
  let version = 0;
  return {
    begin: () => ++version,
    capture: () => version,
    isCurrent: (request: number) => request === version,
    invalidate: () => { version++; },
  };
}
