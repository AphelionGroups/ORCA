/** Roving tabindex for local panels, not application navigation links. */
export function handleTabKey(event: KeyboardEvent) {
  const list = event.currentTarget as HTMLElement;
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(tab => !tab.disabled);
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  let next: number;
  switch (event.key) {
    case 'ArrowRight': next = (index + 1) % tabs.length; break;
    case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
    case 'Home': next = 0; break;
    case 'End': next = tabs.length - 1; break;
    default: return;
  }
  event.preventDefault(); tabs[next].focus(); tabs[next].click();
}

/** Menus keep their existing actions while supporting directional focus. */
export function handleMenuKey(event: KeyboardEvent) {
  const list = event.currentTarget as HTMLElement;
  const items = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).filter(item => !item.disabled);
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0 || !items.length) return;
  let next: number;
  switch (event.key) {
    case 'ArrowDown': next = (index + 1) % items.length; break;
    case 'ArrowUp': next = (index - 1 + items.length) % items.length; break;
    case 'Home': next = 0; break;
    case 'End': next = items.length - 1; break;
    default: return;
  }
  event.preventDefault(); items[next].focus();
}
