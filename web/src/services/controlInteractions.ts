/** Progressive pointer feedback. Coordinates never change a control's hit area. */
export function installControlInteractions(root: HTMLElement): () => void {
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const selector = '.btn-primary, .btn-secondary, .btn-pill-white, .btn-pill-ghost';
  const controls = new Map<HTMLElement, () => void>();
  let current: HTMLElement | undefined;
  let frame = 0;
  let x = 0, y = 0;
  const disabled = (element: HTMLElement) => element.matches(':disabled, [aria-disabled="true"]');
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0;
    current?.style.removeProperty('--hover-x'); current?.style.removeProperty('--hover-y');
    current = undefined;
  };
  const attach = (element: HTMLElement) => {
    if (controls.has(element)) return;
    const move = (event: PointerEvent) => {
      if (!pointer.matches || reduced.matches || event.pointerType !== 'mouse' || disabled(element)) return;
      if (current !== element) reset();
      current = element; x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (current !== element || !root.contains(element) || disabled(element) || !pointer.matches || reduced.matches) { reset(); return; }
        const bounds = element.getBoundingClientRect();
        element.style.setProperty('--hover-x', `${Math.max(0, Math.min(100, (x - bounds.left) / bounds.width * 100))}%`);
        element.style.setProperty('--hover-y', `${Math.max(0, Math.min(100, (y - bounds.top) / bounds.height * 100))}%`);
      });
    };
    const leave = () => { if (current === element) reset(); };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    element.addEventListener('blur', leave);
    controls.set(element, () => {
      leave(); element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', leave); element.removeEventListener('blur', leave);
    });
  };
  const scan = (node: Element) => {
    if (node.matches(selector)) attach(node as HTMLElement);
    node.querySelectorAll<HTMLElement>(selector).forEach(attach);
  };
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) scan(node);
    for (const [element, cleanup] of controls) if (!root.contains(element)) { cleanup(); controls.delete(element); }
    if (current && disabled(current)) reset();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
  pointer.addEventListener('change', reset); reduced.addEventListener('change', reset);
  return () => {
    observer.disconnect(); reset(); pointer.removeEventListener('change', reset); reduced.removeEventListener('change', reset);
    controls.forEach(cleanup => cleanup()); controls.clear();
  };
}
