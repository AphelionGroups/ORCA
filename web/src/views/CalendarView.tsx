import { focusScope } from '../components/focusScope';
import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { Calendar, Plus, ChevronLeft, ChevronRight, RotateCcw, Clock, X } from 'lucide-solid';
import { api } from '../services/api';
import type { CalendarEvent, Task, Space } from '../services/api';
import { addDays, dateKey, calendarDays, moveCalendar, calendarItems, itemsOnDay, taskDate, timedLayout } from '../services/calendar';
import type { CalendarMode, CalendarItem } from '../services/calendar';

interface CalendarViewProps {
  onOpenQuickCapture: () => void;
  onNavigate?: (route: string, spaceId?: string | null) => void;
}
const modes: CalendarMode[] = ['Month', 'Week', 'Day', 'Timeline'];
const formatDay = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CalendarView: Component<CalendarViewProps> = (_props) => {
  const [spaceFilter, setSpaceFilter] = createSignal('all');
  const [scheduleView, setScheduleView] = createSignal<CalendarMode>('Week');
  const [anchor, setAnchor] = createSignal(new Date());
  const [events, setEvents] = createSignal<CalendarEvent[]>([]);
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal('');
  const [isEventModalOpen, setIsEventModalOpen] = createSignal(false);
  const [eventTitle, setEventTitle] = createSignal('');
  const [eventSpaceId, setEventSpaceId] = createSignal('');
  const [eventDate, setEventDate] = createSignal(dateKey(new Date()));
  const [eventStartHour, setEventStartHour] = createSignal('10:00');
  const [eventEndHour, setEventEndHour] = createSignal('11:30');
  const [eventSaving, setEventSaving] = createSignal(false);
  const [eventError, setEventError] = createSignal('');
  let generation = 0, disposed = false;
  onCleanup(() => { disposed = true; generation++; });
  // Fetch independently of filters. Selecting a space never replaces the space list.
  const loadData = async () => {
    const request = ++generation;
    setLoading(true); setLoadError('');
    try {
      const [nextEvents, nextTasks, nextSpaces] = await Promise.all([api.getEvents(), api.getTasks(), api.getSpaces()]);
      if (disposed || request !== generation) return;
      setEvents(nextEvents || []); setTasks(nextTasks || []); setSpaces(nextSpaces || []);
      if (!eventSpaceId()) setEventSpaceId(nextSpaces?.[0]?.id || '');
    } catch (error) {
      if (!disposed && request === generation) setLoadError(error instanceof Error ? error.message : 'Unable to load calendar. Please try again.');
    } finally { if (!disposed && request === generation) setLoading(false); }
  };
  onMount(() => { void loadData(); });
  const matchesSpace = (spaceId?: string) => spaceFilter() === 'all' || spaceId === spaceFilter();
  const items = createMemo(() => calendarItems(events(), tasks()).filter(item => matchesSpace(item.spaceId)));
  const backlogTasks = createMemo(() => tasks().filter(task => matchesSpace(task.space_id) && !taskDate(task) && !events().some(event => event.linked_task_id === task.id) && task.status !== 'done' && task.status !== 'cancelled'));
  const days = createMemo(() => calendarDays(anchor(), scheduleView()));
  const visibleItems = createMemo(() => items().filter(item => item.start < addDays(days().at(-1)!, 1) && item.end > days()[0]!));
  const periodLabel = createMemo(() => scheduleView() === 'Month'
    ? anchor().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : scheduleView() === 'Day' ? `${formatDay(anchor())}, ${anchor().getFullYear()}`
    : `${formatDay(days()[0]!)} – ${formatDay(days().at(-1)!)}, ${days().at(-1)!.getFullYear()}`);
  const getSpaceInfo = (spaceId?: string) => spaces().find(space => space.id === spaceId)?.name || 'General';
  const openEvent = () => {
    setEventDate(dateKey(anchor())); setEventError('');
    if (spaceFilter() !== 'all') setEventSpaceId(spaceFilter());
    setIsEventModalOpen(true);
  };
  const handleCreateEvent = async (event: Event) => {
    event.preventDefault();
    if (eventSaving() || !eventTitle().trim()) return;
    const start = new Date(`${eventDate()}T${eventStartHour()}`), end = new Date(`${eventDate()}T${eventEndHour()}`);
    if (!Number.isFinite(start.getTime()) || !(end > start)) { setEventError('End time must be after start time.'); return; }
    setEventSaving(true); setEventError('');
    try {
      const created = await api.createEvent({ title: eventTitle().trim(), space_id: eventSpaceId() || undefined, start_at: start.toISOString(), end_at: end.toISOString(), is_all_day: false });
      if (disposed) return;
      // Invalidate older refreshes so they cannot overwrite the newly created event.
      generation++; setLoading(false);
      setEvents(previous => [...previous, created]); setEventTitle('');
      setAnchor(start); setIsEventModalOpen(false);
    } catch (error) { if (!disposed) setEventError(error instanceof Error ? error.message : 'Unable to save event. Please try again.'); }
    finally { if (!disposed) setEventSaving(false); }
  };
  const itemCard = (item: CalendarItem) => <div class="calendar-item" classList={{ 'calendar-item-done': item.status === 'done' }} title={`${item.title} · ${getSpaceInfo(item.spaceId)}`}>
    <strong>{item.title}</strong><small>{item.kind} · {getSpaceInfo(item.spaceId)}{item.status === 'done' ? ' · Done' : ''}</small>
    <Show when={!item.allDay}><small>{formatTime(item.start)} – {formatTime(item.end)}</small></Show>
  </div>;

  return <div class="calendar-workspace">
    <header class="orca-header"><div class="header-breadcrumbs"><div class="breadcrumb-title"><Calendar size={17} /><span>Calendar</span></div></div>
      <div class="header-actions"><button class="btn-secondary" aria-label="Refresh events" disabled={loading()} onClick={() => void loadData()}><RotateCcw size={14} /></button>
        <button class="btn-primary" onClick={openEvent}><Plus size={14} /> Add Event</button></div>
    </header>
    <div class="calendar-ribbon">
      <div><h2 aria-live="polite" class="calendar-period">{periodLabel()}</h2>
        <div class="calendar-controls"><button class="btn-secondary" aria-label="Previous period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), -1))}><ChevronLeft size={16} /></button>
          <button class="btn-secondary" onClick={() => setAnchor(new Date())}>Today</button>
          <button class="btn-secondary" aria-label="Next period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), 1))}><ChevronRight size={16} /></button></div>
        <div class="calendar-controls" role="group" aria-label="Filter calendar by space">
          <button class="btn-secondary" aria-pressed={spaceFilter() === 'all'} onClick={() => setSpaceFilter('all')}>All Spaces</button>
          <For each={spaces()}>{space => <button class="btn-secondary" aria-pressed={spaceFilter() === space.id} onClick={() => setSpaceFilter(space.id)}>{space.name}</button>}</For>
        </div>
      </div>
      <div class="calendar-controls" role="group" aria-label="Calendar view"><For each={modes}>{mode => <button class="btn-secondary" aria-pressed={scheduleView() === mode} onClick={() => setScheduleView(mode)}>{mode}</button>}</For></div>
    </div>
    <Show when={loadError()}><p role="alert" class="calendar-message">{loadError()} <button class="btn-secondary" onClick={() => void loadData()}>Retry</button></p></Show>
    <Show when={loading()}><p role="status" class="calendar-message">Loading calendar…</p></Show>
    <div class="calendar-layout" aria-busy={loading()}>
      <aside class="calendar-backlog"><h3>Unscheduled tasks <span>({backlogTasks().length})</span></h3><p>Active tasks without a planned date or due date.</p>
        <For each={backlogTasks()} fallback={<p>No unscheduled tasks.</p>}>{task => <div class="calendar-item"><strong>{task.title}</strong><small>{getSpaceInfo(task.space_id)}<Show when={task.estimated_minutes}> · {task.estimated_minutes} min</Show></small></div>}</For>
      </aside>
      <section class="calendar-matrix" aria-label={`${scheduleView()} calendar`}>
        <Show when={scheduleView() === 'Month'}>
          <div class="calendar-month-head"><For each={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}>{day => <span>{day}</span>}</For></div>
          <div class="calendar-month"><For each={days()}>{day => <div class="calendar-month-day" data-date={dateKey(day)} classList={{ 'calendar-outside': day.getMonth() !== anchor().getMonth(), 'calendar-today': dateKey(day) === dateKey(new Date()) }}>
            <button class="calendar-date" aria-label={`View ${formatDay(day)}`} onClick={() => { setAnchor(day); setScheduleView('Day'); }}>{day.getDate()}</button>
            <For each={itemsOnDay(items(), day)}>{itemCard}</For>
          </div>}</For></div>
        </Show>
        <Show when={scheduleView() === 'Timeline'}>
          <div class="calendar-timeline"><For each={days()}>{day => <section data-date={dateKey(day)}><h3>{formatDay(day)}</h3>
            <For each={itemsOnDay(items(), day)} fallback={<p>No scheduled items.</p>}>{itemCard}</For>
          </section>}</For></div>
        </Show>
        <Show when={scheduleView() === 'Week' || scheduleView() === 'Day'}>
          <div class="calendar-time-head" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}><span>Time</span>
            <For each={days()}>{day => <div classList={{ 'calendar-today': dateKey(day) === dateKey(new Date()) }}>{formatDay(day)}
              <For each={itemsOnDay(items(), day).filter(item => item.allDay)}>{itemCard}</For>
            </div>}</For>
          </div>
          <div class="calendar-time-scroll"><div class="calendar-time-grid" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}>
            <div class="calendar-hours"><For each={Array.from({ length: 24 }, (_, index) => index)}>{hour => <span>{String(hour).padStart(2, '0')}:00</span>}</For></div>
            <For each={days()}>{day => <div class="calendar-time-day" data-date={dateKey(day)}><For each={timedLayout(items(), day)}>{row => <div class="calendar-timed-item" style={{ top: `${row.top}px`, height: `${row.height}px`, left: `${row.lane / row.lanes * 100}%`, width: `${100 / row.lanes}%` }}>{itemCard(row.item)}</div>}</For></div>}</For>
          </div></div>
        </Show>
        <Show when={!loading() && !loadError() && visibleItems().length === 0}><p class="calendar-message" role="status">No events or dated tasks in this period.</p></Show>
      </section>
    </div>
      {/* Add Event Modal */}
      <Show when={isEventModalOpen()}>
        <div class="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            "z-index": 60,
            display: 'flex',
            "align-items": 'center',
            "justify-content": 'center',
            "background-color": 'var(--overlay)',
            "backdrop-filter": 'none',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsEventModalOpen(false); }}
        >
          <div class="modal-card" ref={el => focusScope(el, () => setIsEventModalOpen(false))} style={{
            position: 'relative',
            width: '100%',
            "max-width": '420px',
            "background-color": 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            "box-shadow": 'var(--shadow-elevation)',
            "border-radius": '8px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '16px' }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--primary)" />
                <h3 style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)', margin: 0 }}>Schedule Event</h3>
              </div>
              <button
                aria-label="Close event dialog" onClick={() => setIsEventModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <Show when={eventError()}><p role="alert" class="modal-error-badge">{eventError()}</p></Show>
            <form onSubmit={handleCreateEvent} aria-busy={eventSaving()} style={{ display: 'flex', "flex-direction": 'column', gap: '12px' }}>
              <div>
                <label for="event-title" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>EVENT TITLE</label>
                <input
                  id="event-title" required type="text"
                  autofocus
                  value={eventTitle()}
                  onInput={e => setEventTitle(e.currentTarget.value)}
                  placeholder="e.g. Design Strategy Sync..."
                  style={{ width: '100%', padding: '6px 10px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label for="event-space" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>SPACE</label>
                  <select id="event-space"
                    value={eventSpaceId()}
                    onChange={e => setEventSpaceId(e.currentTarget.value)}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <For each={spaces()}>
                      {(sp) => <option value={sp.id}>{sp.name}</option>}
                    </For>
                  </select>
                </div>

                <div>
                  <label for="event-date" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>DATE</label>
                  <input id="event-date" type="date" required value={eventDate()} onInput={e => setEventDate(e.currentTarget.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label for="event-start" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>START TIME</label>
                  <input
                    id="event-start" required type="time"
                    value={eventStartHour()}
                    onInput={e => setEventStartHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
                <div>
                  <label for="event-end" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>END TIME</label>
                  <input
                    id="event-end" required type="time"
                    value={eventEndHour()}
                    onInput={e => setEventEndHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px', "margin-top": '8px' }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() => setIsEventModalOpen(false)}
                  style={{ padding: '6px 14px', "font-size": '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={eventSaving()}
                  class="btn-primary"
                  style={{ padding: '6px 16px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }}
                >
                  <Clock size={13} />
                  <span>{eventSaving() ? 'Saving...' : 'Book Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>;
};
