import { onCleanup, onMount } from 'solid-js';

/** Focus management shared by mounted dialogs; preserves the invoking control. */
export function focusScope(element: HTMLElement, close: () => void) {
  const previous = document.activeElement as HTMLElement | null;
  const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
  const controls = () => Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(el => el.getClientRects().length && !el.closest('[inert]'));
  let titleId: string | undefined;
  onMount(() => {
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      const title = element.querySelector<HTMLElement>('h2, h3, .modal-title');
      if (title) {
        titleId = title.id || `orca-dialog-${++dialogSequence}`;
        title.id = titleId;
        element.setAttribute('aria-labelledby', titleId);
      }
    }
    element.tabIndex = -1;
    // Associate existing visible form labels with their adjacent controls.
    element.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(label => {
      const field = label.parentElement?.querySelector<HTMLInputElement>('input:not([type="file"]), select, textarea');
      if (field) { field.id ||= `orca-field-${++dialogSequence}`; label.htmlFor = field.id; }
    });
    (controls().find(el => el.matches('input:not([type="file"]), textarea, select')) || controls()[0] || element).focus();
  });
  const keydown = (event: KeyboardEvent) => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(el => el.getClientRects().length);
    if (dialogs.at(-1) !== element) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const items = controls(); const first = items[0]; const last = items.at(-1);
    if (!first) { event.preventDefault(); element.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keydown, true);
  onCleanup(() => { document.removeEventListener('keydown', keydown, true); if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); });
}
let dialogSequence = 0;
