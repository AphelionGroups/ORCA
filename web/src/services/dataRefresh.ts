import { onMount, onCleanup } from 'solid-js';

const revisionKey = 'orca:data-revision';
let revision = 0;
export const dataRevision = () => revision;
export function announceDataChange() {
  revision++;
  window.dispatchEvent(new Event('orca:data_changed'));
  try { localStorage.setItem(revisionKey, crypto.randomUUID()); } catch { /* Same-tab updates still work when storage is blocked. */ }
}

/** Coalesce invalidations and defer background reads while the user is editing. */
export function useDataRefresh(refresh: () => Promise<unknown>, canRefresh: () => boolean = () => true) {
  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false, running = false, pending = false;
    const schedule = () => {
      if (stopped) return;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(run, 250);
    };
    const run = async () => {
      if (stopped || !pending || running || document.visibilityState === 'hidden') return;
      const field = document.activeElement;
      if (!canRefresh() || document.querySelector('[aria-modal="true"]') || field?.matches('input, textarea, select, [contenteditable="true"]')) {
        timer = setTimeout(run, 500); return;
      }
      pending = false; running = true;
      try { await refresh(); } catch { /* Loaders expose their own retry state. */ }
      finally { running = false; if (pending && !stopped) schedule(); }
    };
    const visible = () => { if (document.visibilityState === 'visible') schedule(); };
    const storage = (event: StorageEvent) => { if (event.key === revisionKey) schedule(); };
    window.addEventListener('orca:data_changed', schedule);
    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    onCleanup(() => {
      stopped = true; clearTimeout(timer);
      window.removeEventListener('orca:data_changed', schedule);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    });
  });
}
