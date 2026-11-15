import { openExport, openImport } from '../services/transfer';
import { TaskContext } from '../components/TaskContext';
import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { House, Plus, SlidersHorizontal, X, GripVertical, MoveDownRight, ListTodo, CalendarDays, FolderKanban, ChevronRight } from 'lucide-solid';
import { api, type Task, type CalendarEvent, type Project, type Space } from '../services/api';
import type { UserProfile } from '../services/user';
import { dashboardTasks, defaultLayout, defaultWidget, parseLayout, snapWidgetSize, widgetWidths, widgetHeights, widgetCatalog, type WidgetLayout, type WidgetID } from '../services/dashboard';
import { overlapsDay, zonedParts } from '../services/calendarDates';
import { TaskModal } from '../components/TaskModal';
import { TASK_STATUS_OPTIONS } from '../services/taskContract';
import '../styles/dashboard.css';
import { PageOptions } from '../components/PageOptions';
import { useDataRefresh } from '../services/dataRefresh';

interface Props {
  currentUser: UserProfile;
  refreshVersion: number;
  onOpenQuickCapture: () => void;
  onNavigate: (route: string, spaceId?: string | null, projectId?: string | null) => void;
}
export function HomeView(props: Props) {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [events, setEvents] = createSignal<CalendarEvent[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [zone, setZone] = createSignal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [now, setNow] = createSignal(new Date());
  const today = createMemo(() => zonedParts(now(), zone()).date);
  const [editing, setEditing] = createSignal(false);
  const [layout, setLayout] = createSignal<WidgetLayout[]>(defaultLayout());
  const [storageMessage, setStorageMessage] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
  const [gesture, setGesture] = createSignal<{ id: WidgetID; mode: 'move' | 'resize'; dx: number; dy: number; columns: WidgetLayout['columns']; height: WidgetLayout['height'] } | null>(null);
  const [dropTarget, setDropTarget] = createSignal<WidgetID | null>(null);
  const [announcement, setAnnouncement] = createSignal('');
  let pointer: { id: number; x: number; y: number; width: number; columns: number; height: number; element: HTMLElement; edge: string } | null = null;
  const cancelGesture = () => {
    if (pointer?.element.hasPointerCapture(pointer.id)) pointer.element.releasePointerCapture(pointer.id);
    pointer = null; setGesture(null); setDropTarget(null);
  };
  const beginGesture = (event: PointerEvent, widget: WidgetLayout, mode: 'move' | 'resize', edge = 'corner') => {
    if (!editing() || pointer || event.button !== 0 || !event.isPrimary) return;
    if (mode === 'move' && (event.target as HTMLElement).closest('button, [data-resize]')) return;
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;
    const grid = element.closest('.dashboard-grid')!.getBoundingClientRect();
    event.preventDefault(); element.focus(); element.setPointerCapture(event.pointerId);
    const columns = grid.width < 600 ? 12 : grid.width < 850 ? Math.max(6, widget.columns) : widget.columns;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, width: grid.width, columns, height: widget.height, element, edge };
    setGesture({ id: widget.id, mode, dx: 0, dy: 0, columns: columns as WidgetLayout['columns'], height: widget.height });
  };
  const updateGesture = (event: PointerEvent) => {
    const current = gesture();
    if (!pointer || !current || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (current.mode === 'resize') {
      const horizontal = pointer.edge !== 'bottom';
      const vertical = pointer.edge === 'bottom' || pointer.edge === 'corner';
      const size = snapWidgetSize(pointer.columns + (horizontal ? dx * (pointer.edge === 'left' ? -1 : 1) / ((pointer.width + 24) / 12) : 0), pointer.height + (vertical ? dy : 0));
      if (pointer.width < 600) size.columns = 12;
      else if (pointer.width < 850 && size.columns < 6) size.columns = 6;
      setGesture({ ...current, dx, dy, ...size });
    } else {
      setGesture({ ...current, dx, dy });
      const target = document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest<HTMLElement>('[data-widget]')).find(element => element && element.dataset.widget !== current.id);
      setDropTarget(target?.dataset.widget as WidgetID || null);
      const scroll = pointer.element.closest('.dashboard-content')!;
      const bounds = scroll.getBoundingClientRect();
      if (event.clientY > bounds.bottom - 48) scroll.scrollBy(0, 16);
      else if (event.clientY < bounds.top + 48) scroll.scrollBy(0, -16);
    }
  };
  const finishGesture = (event: PointerEvent) => {
    const current = gesture();
    if (!pointer || !current || event.pointerId !== pointer.id) return;
    if (current.mode === 'resize') {
      saveLayout(layout().map(item => item.id === current.id ? { ...item, columns: current.columns, height: current.height } : item));
      setAnnouncement('Widget size saved.');
    } else if (dropTarget()) {
      const next = [...layout()], source = next.findIndex(item => item.id === current.id), target = next.findIndex(item => item.id === dropTarget());
      const [item] = next.splice(source, 1); next.splice(target, 0, item!); saveLayout(next);
      setAnnouncement('Widget order saved.');
    }
    cancelGesture();
  };
  const resizeWidget = (id: WidgetID, size: Partial<Pick<WidgetLayout, 'columns' | 'height'>>) => saveLayout(layout().map(item => item.id === id ? { ...item, ...size } : item));
  const storageKey = () => `orca:dashboard:v1:${props.currentUser.workspace_id || 'personal'}:${props.currentUser.id}`;
  createEffect(() => {
    try { setLayout(parseLayout(localStorage.getItem(storageKey()))); }
    catch { setLayout(defaultLayout()); setStorageMessage('Layout changes will last only while this page is open.'); }
  });
  const saveLayout = (next: WidgetLayout[]) => {
    setLayout(next);
    try { localStorage.setItem(storageKey(), JSON.stringify(next)); setStorageMessage(''); }
    catch { setStorageMessage('Your layout could not be saved. It will last only while this page is open.'); }
  };
  let generation = 0, disposed = false;
  const load = async (background = false) => {
    const request = ++generation;
    if (!background) setLoading(true); setError('');
    try {
      const [nextTasks, nextEvents, nextProjects, nextSpaces, preferences] = await Promise.all([
        api.getTasks(), api.getEvents(), api.getProjects(), api.getSpaces(), api.getPreferences(),
      ]);
      if (disposed || request !== generation) return;
      setTasks(nextTasks); setEvents(nextEvents); setProjects(nextProjects); setSpaces(nextSpaces);
      if (preferences.calendar_timezone) setZone(preferences.calendar_timezone);
    } catch (failure) {
      if (!disposed && request === generation) setError(failure instanceof Error ? failure.message : 'Unable to load Home.');
    } finally { if (!disposed && request === generation) setLoading(false); }
  };
  createEffect(() => { props.refreshVersion; void load(); });
  onMount(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    onCleanup(() => clearInterval(tick));
  });
  useDataRefresh(() => { setNow(new Date()); return load(true); }, () => !editing() && !loading());
  onCleanup(() => { disposed = true; generation++; cancelGesture(); });
  const lists = createMemo(() => dashboardTasks(tasks(), events(), today(), zone()));
  const agenda = createMemo(() => events().filter(event => overlapsDay(event, today(), zone())).sort((a,b) => a.start_at.localeCompare(b.start_at)));
  const context = (task: Task) => projects().find(project => project.id === task.project_id)?.name || spaces().find(space => space.id === task.space_id)?.name || 'Workspace';
  const move = (id: WidgetID, direction: number) => {
    const next = [...layout()], index = next.findIndex(widget => widget.id === id), target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!]; saveLayout(next);
  };
  const taskRows = (list: Task[], empty: string) => <Show when={list.length} fallback={<p class="dashboard-empty">{empty}</p>}>
    <ul class="dashboard-list"><For each={list}>{task => <li><button class="dashboard-task" aria-label={`Open task: ${task.title}`} aria-haspopup="dialog" onClick={() => setSelectedTask(task)}>
      <span class="dashboard-item-icon" aria-hidden="true"><ListTodo size={18} /></span>
      <span class="dashboard-item-copy"><span class="dashboard-task-title">{task.title}</span><TaskContext task={task} /><span class="dashboard-task-context"><span>{context(task)}</span><span class="dashboard-task-status">{TASK_STATUS_OPTIONS.find(option => option.value === task.status)?.label || task.status}</span></span></span>
      <ChevronRight class="dashboard-item-chevron" size={17} aria-hidden="true" />
    </button></li>}</For></ul>
  </Show>;
  return <div class="dashboard-page">
    <header class="orca-header"><div class="header-breadcrumbs"><House size={16} /><span>Home</span></div>
      <div class="header-actions"><PageOptions onExport={() => openExport({ kind: 'workspace' })} onImport={() => openImport()} onRefresh={() => load()} busy={loading() || editing()} /><button class="btn-secondary" onClick={() => { cancelGesture(); setEditing(value => !value); }} aria-pressed={editing()}><SlidersHorizontal size={14} />{editing() ? 'Done customizing' : 'Customize'}</button>
      <button class="btn-primary" onClick={props.onOpenQuickCapture}><Plus size={14} />Quick capture</button></div>
    </header>
    <div class="dashboard-content">
      <div class="dashboard-intro"><div><h1>Today, at a glance.</h1><p>{new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone() }).format(now())}</p></div>
      </div>
      <Show when={editing()}><section class="dashboard-customize" aria-label="Customize dashboard">
        <div><h2>Your dashboard</h2><p>Drag anywhere on a widget to move it. Pull its edges or corner to resize.</p></div>
        <div class="dashboard-catalog"><For each={widgetCatalog}>{widget => <button class="btn-secondary" disabled={layout().some(item => item.id === widget.id)} title={widget.description} onClick={() => saveLayout([...layout(), defaultWidget(widget.id)])}><Plus size={14} />{widget.title}</button>}</For></div>
        <button class="dashboard-text-button" onClick={() => saveLayout(defaultLayout())}>Restore default layout</button>
        <p class="dashboard-storage-note">Layout is saved in this browser.</p>
      </section></Show>
      <Show when={storageMessage()}><p role="status">{storageMessage()}</p></Show>
      <span id="dashboard-edit-help" class="dashboard-announcement">Drag the card to reorder, or use arrow keys. Pull an edge to resize, or use Shift and arrow keys. Escape cancels dragging.</span>
      <span class="dashboard-announcement" role="status" aria-live="polite">{announcement()}</span>
      <Show when={error()}><div class="dashboard-error" role="alert">{error()} <button class="btn-secondary" onClick={() => void load()}>Coba lagi</button></div></Show>
      <Show when={!loading()} fallback={<p role="status">Loading your dashboard…</p>}>
        <Show when={layout().length} fallback={<div class="dashboard-empty"><h2>Make room for your day.</h2><p>Add a widget to build your Home.</p><button class="btn-secondary" onClick={() => setEditing(true)}>Add widgets</button></div>}>
          <div class="dashboard-grid"><For each={layout()}>{widget => {
            const definition = widgetCatalog.find(item => item.id === widget.id)!;
            const count = () => widget.id === 'daily' ? lists().daily.length : widget.id === 'unscheduled' ? lists().unscheduled.length : widget.id === 'agenda' ? agenda().length : projects().length;
            const active = () => gesture()?.id === widget.id ? gesture() : null;
            return <section class={`dashboard-widget ${editing() ? 'dashboard-widget-editing' : ''} ${active()?.mode === 'move' ? 'dashboard-widget-dragging' : ''} ${dropTarget() === widget.id ? 'dashboard-widget-target' : ''}`} data-widget={widget.id} data-columns={active()?.mode === 'resize' ? active()!.columns : widget.columns} style={{ '--widget-columns': active()?.mode === 'resize' ? active()!.columns : widget.columns, height: `${active()?.mode === 'resize' ? active()!.height : widget.height}px`, transform: active()?.mode === 'move' ? `translate(${active()!.dx}px, ${active()!.dy}px)` : undefined }} aria-label={definition.title} tabindex={editing() ? 0 : undefined} aria-describedby={editing() ? 'dashboard-edit-help' : undefined} onPointerDown={event => beginGesture(event, widget, 'move')} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={event => { if (event.target === pointer?.element) cancelGesture(); }} onKeyDown={event => {
              if (!editing() || event.target !== event.currentTarget) return;
              if (event.key === 'Escape') { cancelGesture(); return; }
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              if (event.shiftKey) {
                const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
                const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                if (horizontal) resizeWidget(widget.id, { columns: widgetWidths[Math.max(0, Math.min(widgetWidths.length - 1, widgetWidths.indexOf(widget.columns) + direction))] });
                else resizeWidget(widget.id, { height: widgetHeights[Math.max(0, Math.min(widgetHeights.length - 1, widgetHeights.indexOf(widget.height) + direction))] });
              } else move(widget.id, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
              queueMicrotask(() => document.querySelector<HTMLElement>(`[data-widget="${widget.id}"]`)?.focus());
            }}>
              <header class="dashboard-widget-header"><Show when={editing()}><span class="dashboard-drag-cue" aria-hidden="true"><GripVertical size={16} /></span></Show><div><h2>{definition.title}<span class="dashboard-count">{count()}</span></h2><p>{definition.description}</p></div>
                <Show when={editing()}><div class="dashboard-widget-controls">
                  <button class="btn-ghost-icon" aria-label={`Remove ${definition.title}`} onClick={() => saveLayout(layout().filter(item => item.id !== widget.id))}><X size={14} /></button>
                </div></Show>
              </header>
              <div class="dashboard-widget-body" inert={editing()}>
              <Show when={widget.id === 'daily'}>{taskRows(lists().daily, 'No open tasks planned, due, or scheduled for today.')}</Show>
              <Show when={widget.id === 'unscheduled'}>{taskRows(lists().unscheduled, 'All open tasks have a date or calendar session.')}</Show>
              <Show when={widget.id === 'agenda'}><Show when={agenda().length} fallback={<p class="dashboard-empty">No calendar sessions today.</p>}><ul class="dashboard-list"><For each={agenda()}>{event => <li><button class="dashboard-task" aria-label={`Open calendar: ${event.title}`} onClick={() => props.onNavigate('calendar')}><span class="dashboard-item-icon" aria-hidden="true"><CalendarDays size={18} /></span><span class="dashboard-item-copy"><span class="dashboard-task-title">{event.title}</span><span class="dashboard-task-context">{event.is_all_day ? 'All day' : new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: zone() }).format(new Date(event.start_at))}</span></span><ChevronRight class="dashboard-item-chevron" size={17} aria-hidden="true" /></button></li>}</For></ul></Show></Show>
              <Show when={widget.id === 'projects'}><Show when={projects().length} fallback={<p class="dashboard-empty">Your projects will appear here.</p>}><ul class="dashboard-list"><For each={projects()}>{project => <li><button class="dashboard-task" aria-label={`Open project: ${project.name}`} onClick={() => props.onNavigate('projects', project.space_id, project.id)}><span class="dashboard-item-icon" aria-hidden="true"><FolderKanban size={18} /></span><span class="dashboard-item-copy"><span class="dashboard-task-title">{project.name}</span><span class="dashboard-task-context">{spaces().find(space => space.id === project.space_id)?.name || 'Workspace'}</span></span><ChevronRight class="dashboard-item-chevron" size={17} aria-hidden="true" /></button></li>}</For></ul></Show></Show>
              </div>
              <Show when={editing()}><For each={['left', 'right', 'bottom', 'corner']}>{edge => <span class={`dashboard-resize-edge dashboard-resize-${edge}`} data-resize={edge} aria-hidden="true" onPointerDown={event => beginGesture(event, widget, 'resize', edge)} onPointerMove={updateGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={event => { if (event.target === pointer?.element) cancelGesture(); }}>{edge === 'corner' ? <MoveDownRight size={16} /> : undefined}</span>}</For></Show>
            </section>;
          }}</For></div>
        </Show>
      </Show>
    </div>
    <Show when={selectedTask()}><TaskModal isOpen={true} taskToEdit={selectedTask()} onClose={() => setSelectedTask(null)} onSaved={task => { setTasks(previous => previous.map(item => item.id === task.id ? task : item)); setSelectedTask(null); void load(); }} onDeleted={id => { setTasks(previous => previous.filter(item => item.id !== id)); setSelectedTask(null); void load(); }} /></Show>
  </div>;
}
