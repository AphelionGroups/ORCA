import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Ellipsis, RotateCcw, Download, Upload } from 'lucide-solid';
import './pageOptions.css';

export function PageOptions(props: { onRefresh: () => unknown; busy?: boolean; onExport?: () => void; onImport?: () => void }) {
  const [open, setOpen] = createSignal(false);
  const [position, setPosition] = createSignal({ left: 8, top: 8 });
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  const positionMenu = () => {
    const bounds = trigger.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(bounds.right - 192, window.innerWidth - 200)), top: Math.max(8, Math.min(bounds.bottom + 8, window.innerHeight - (48 * (1 + Number(!!props.onExport) + Number(!!props.onImport)) + 16))) });
  };
  const showMenu = () => { positionMenu(); setOpen(true); };
  onMount(() => {
    const outside = (event: PointerEvent) => { if (!root.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && open()) { setOpen(false); trigger.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', positionMenu);
    onCleanup(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', positionMenu); });
  });
  return <div class="page-options" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.focus(); }
    if (event.key === 'ArrowDown' && event.target === trigger) { event.preventDefault(); showMenu(); queueMicrotask(() => root.querySelector<HTMLButtonElement>('.page-options-action')?.focus()); }
  }}>
    <button ref={trigger} type="button" class="btn-ghost-icon" aria-label="Page options" aria-expanded={open()} onClick={() => open() ? setOpen(false) : showMenu()}><Ellipsis size={18} /></button>
    <Show when={open()}><div class="page-options-popover" style={{ left: `${position().left}px`, top: `${position().top}px` }}><button type="button" class="page-options-action" disabled={props.busy} onClick={() => { setOpen(false); trigger.focus(); void props.onRefresh(); }}><RotateCcw size={14} />Refresh data</button><Show when={props.onExport}><button type="button" class="page-options-action" disabled={props.busy} onClick={() => { setOpen(false); trigger.focus(); props.onExport?.(); }}><Download size={14} />Export</button></Show><Show when={props.onImport}><button type="button" class="page-options-action" disabled={props.busy} onClick={() => { setOpen(false); trigger.focus(); props.onImport?.(); }}><Upload size={14} />Import paket</button></Show></div></Show>
  </div>;
}
