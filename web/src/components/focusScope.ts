import { onCleanup, onMount } from 'solid-js';

let sequence = 0;
/** Mounted dialogs own focus only while they are the top visible overlay. */
export function focusScope(element: HTMLElement, close: () => void) {
  const previous = document.activeElement as HTMLElement | null;
  const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
  const controls = () => Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(item => item.getClientRects().length && !item.closest('[inert]'));
  onMount(() => {
    element.setAttribute('role', 'dialog'); element.setAttribute('aria-modal', 'true'); element.tabIndex = -1;
    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      const title = element.querySelector<HTMLElement>('h2, h3, .modal-title');
      if (title) { title.id ||= `orca-dialog-${++sequence}`; element.setAttribute('aria-labelledby', title.id); }
    }
    element.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(label => {
      const input = label.parentElement?.querySelector<HTMLInputElement>('input:not([type="file"]), textarea, select');
      if (input) { input.id ||= `orca-field-${++sequence}`; label.htmlFor = input.id; }
    });
    (controls().find(item => item.matches('input:not([type="file"]), textarea, select')) || controls()[0] || element).focus();
  });
  const keyboard = (event: KeyboardEvent) => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(item => item.getClientRects().length);
    if (dialogs.at(-1) !== element) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const items = controls(), first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); element.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keyboard, true);
  onCleanup(() => { document.removeEventListener('keydown', keyboard, true); if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); });
}
