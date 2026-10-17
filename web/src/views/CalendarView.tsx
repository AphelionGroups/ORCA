import { focusScope } from '../components/focusScope';
import { TaskModal } from '../components/TaskModal';
import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { Calendar, Plus, ChevronLeft, ChevronRight, RotateCcw, Clock, X } from 'lucide-solid';
import { api } from '../services/api';
import type { CalendarEvent, Task, Space } from '../services/api';
import { addDays, dateKey, calendarDays, moveCalendar, calendarItems, itemsOnDay, taskDate, timedLayout } from '../services/calendar';
import type { CalendarMode, CalendarItem } from '../services/calendar';
import { wallTimeToInstant, zonedParts } from '../services/calendarDates';

interface CalendarViewProps {
  onOpenQuickCapture: () => void;
  onNavigate?: (route: string, spaceId?: string | null) => void;
}
const modes: CalendarMode[] = ['Month', 'Week', 'Day', 'Timeline'];
const formatDay = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CalendarView: Component<CalendarViewProps> = (_props) => {
  const [spaceFilter, setSpaceFilter] = createSignal('all');
  const [zone, setZone] = createSignal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const zonedDate = (instant: string | Date) => {
    const parts = zonedParts(instant, zone());
    return new Date(`${parts.date}T${parts.time}`);
  };
  const [scheduleView, setScheduleView] = createSignal<CalendarMode>(window.matchMedia('(max-width: 767px)').matches ? 'Day' : 'Week');
  const [showHours, setShowHours] = createSignal(false);
  const [selectedItem, setSelectedItem] = createSignal<{ kind: 'Event' | 'Task'; id: string } | null>(null);
  const [taskToEdit, setTaskToEdit] = createSignal<Task | null>(null);
  const detailEvent = createMemo(() => selectedItem()?.kind === 'Event' ? events().find(event => event.id === selectedItem()?.id) : undefined);
  const detailTask = createMemo(() => selectedItem()?.kind === 'Task' ? tasks().find(task => task.id === selectedItem()?.id) : undefined);
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
  const [eventEndDate, setEventEndDate] = createSignal(dateKey(new Date()));
  const [eventAllDay, setEventAllDay] = createSignal(false);
  const [eventTaskId, setEventTaskId] = createSignal('');
  const [editingEvent, setEditingEvent] = createSignal<CalendarEvent | null>(null);
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
  onMount(() => {
    void loadData();
    void api.getPreferences().then(preferences => {
      if (!disposed && preferences.calendar_timezone) {
        setZone(preferences.calendar_timezone); setAnchor(zonedDate(new Date()));
      }
    }).catch(error => { if (!disposed) setLoadError(error instanceof Error ? error.message : 'Unable to load calendar preferences.'); });
  });
  const selectZone = async (value: string) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      await api.updatePreferences(value);
      if (!disposed) { setZone(value); setAnchor(zonedDate(new Date())); }
    } catch (error) { if (!disposed) setLoadError(error instanceof Error ? error.message : 'Enter a valid timezone.'); }
  };
  const matchesSpace = (spaceId?: string) => spaceFilter() === 'all' || spaceId === spaceFilter();
  const items = createMemo(() => calendarItems(events().map(event => {
    const start = zonedDate(event.start_at), end = zonedDate(event.end_at);
    // Keep repeated-hour sessions visible when daylight saving time ends.
    const displayEnd = end > start ? end : new Date(start.getTime() + Date.parse(event.end_at) - Date.parse(event.start_at));
    return { ...event, start_at: start.toISOString(), end_at: displayEnd.toISOString() };
  }), tasks()).filter(item => matchesSpace(item.spaceId)));
  const backlogTasks = createMemo(() => tasks().filter(task => matchesSpace(task.space_id) && !taskDate(task) && !events().some(event => event.linked_task_id === task.id) && task.status !== 'done' && task.status !== 'cancelled'));
  const days = createMemo(() => calendarDays(anchor(), scheduleView()));
  const visibleItems = createMemo(() => items().filter(item => item.start < addDays(days().at(-1)!, 1) && item.end > days()[0]!));
  const periodLabel = createMemo(() => scheduleView() === 'Month'
    ? anchor().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : scheduleView() === 'Day' ? `${formatDay(anchor())}, ${anchor().getFullYear()}`
    : `${formatDay(days()[0]!)} – ${formatDay(days().at(-1)!)}, ${days().at(-1)!.getFullYear()}`);
  const getSpaceInfo = (spaceId?: string) => spaces().find(space => space.id === spaceId)?.name || 'General';
  const openEvent = (task?: Task) => {
    const target = task ? taskDate(task) || anchor() : anchor();
    setEditingEvent(null); setEventTitle(task?.title || ''); setEventTaskId(task?.id || '');
    setEventDate(dateKey(target)); setEventEndDate(dateKey(target)); setEventAllDay(false); setEventError('');
    if (spaceFilter() !== 'all') setEventSpaceId(spaceFilter());
    if (task) {
      setEventSpaceId(task.space_id); setEventStartHour('10:00');
      const end = 600 + Math.max(15, Math.min(720, task.estimated_minutes || 60));
      setEventEndHour(`${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`);
    }
    setIsEventModalOpen(true);
  };
  const editEvent = (event: CalendarEvent) => {
    const start = zonedDate(event.start_at), end = zonedDate(event.end_at);
    setEditingEvent(event); setEventTitle(event.title); setEventSpaceId(event.space_id || '');
    setEventTaskId(event.linked_task_id || ''); setEventAllDay(event.is_all_day);
    setEventDate(dateKey(start)); setEventEndDate(dateKey(event.is_all_day ? addDays(end, -1) : end));
    setEventStartHour(zonedParts(event.start_at, zone()).time); setEventEndHour(zonedParts(event.end_at, zone()).time);
    setEventError(''); setIsEventModalOpen(true);
  };
  const removeEvent = async () => {
    const current = editingEvent(); if (!current || eventSaving()) return;
    setEventSaving(true); setEventError('');
    try {
      await api.deleteEvent(current.id);
      if (!disposed) { generation++; setLoading(false); setEvents(previous => previous.filter(event => event.id !== current.id)); setIsEventModalOpen(false); }
    } catch (error) { if (!disposed) setEventError(error instanceof Error ? error.message : 'Unable to delete event.'); }
    finally { if (!disposed) setEventSaving(false); }
  };
  const handleCreateEvent = async (event: Event) => {
    event.preventDefault();
    if (eventSaving() || !eventTitle().trim()) return;
    setEventSaving(true); setEventError('');
    try {
      const start = wallTimeToInstant(eventDate(), eventAllDay() ? '00:00' : eventStartHour(), zone());
      const endDay = eventAllDay() ? dateKey(addDays(new Date(`${eventEndDate()}T00:00`), 1)) : eventEndDate();
      const end = wallTimeToInstant(endDay, eventAllDay() ? '00:00' : eventEndHour(), zone());
      if (Date.parse(end) <= Date.parse(start)) throw new Error('End time must be after start time.');
      const data = { title: eventTitle().trim(), space_id: eventSpaceId() || null, linked_task_id: eventTaskId() || null, start_at: start, end_at: end, is_all_day: eventAllDay() };
      const current = editingEvent();
      const created = current ? await api.updateEvent(current.id, { ...data, expected_updated_at: current.updated_at })
        : await api.createEvent({ ...data, space_id: data.space_id || undefined, linked_task_id: data.linked_task_id || undefined });
      if (disposed) return;
      // Invalidate older refreshes so they cannot overwrite the newly created event.
      generation++; setLoading(false);
      setEvents(previous => [...previous.filter(event => event.id !== created.id), created]); setEventTitle('');
      setAnchor(zonedDate(start)); setIsEventModalOpen(false);
    } catch (error) { if (!disposed) setEventError(error instanceof Error ? error.message : 'Unable to save event. Please try again.'); }
    finally { if (!disposed) setEventSaving(false); }
  };
  const itemCard = (item: CalendarItem) => <button type="button" class="calendar-item calendar-entry" classList={{ 'calendar-item-done': item.status === 'done' }}
    aria-label={item.title} onClick={() => setSelectedItem({ kind: item.kind, id: item.id.slice(item.id.indexOf(':') + 1) })}>
    <strong>{item.title}</strong>
    <span class="calendar-entry-meta">{item.allDay ? item.kind === 'Task' ? 'Task' : 'All day' : `${formatTime(item.start)} – ${formatTime(item.end)}`}</span>
  </button>;

  return <div class="calendar-workspace">
    <header class="orca-header"><div class="header-breadcrumbs"><div class="breadcrumb-title"><Calendar size={17} /><span>Calendar</span></div></div>
      <div class="header-actions"><button class="btn-secondary" aria-label="Refresh events" disabled={loading()} onClick={() => void loadData()}><RotateCcw size={14} /></button>
        <button class="btn-primary" onClick={() => openEvent()}><Plus size={14} /> Add Event</button></div>
    </header>
    <div class="calendar-ribbon">
      <div><h2 aria-live="polite" class="calendar-period">{periodLabel()}</h2>
        <div class="calendar-controls"><button class="btn-secondary" aria-label="Previous period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), -1))}><ChevronLeft size={16} /></button>
          <button class="btn-secondary" onClick={() => setAnchor(zonedDate(new Date()))}>Today</button>
          <button class="btn-secondary" aria-label="Next period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), 1))}><ChevronRight size={16} /></button></div>
      </div>
      <div class="calendar-filters">
        <label>Space<select aria-label="Calendar space" value={spaceFilter()} onChange={event => setSpaceFilter(event.currentTarget.value)}><option value="all">All Spaces</option><For each={spaces()}>{space => <option value={space.id}>{space.name}</option>}</For></select></label>
        <label>View<select aria-label="Calendar view" value={scheduleView()} onChange={event => setScheduleView(event.currentTarget.value as CalendarMode)}><For each={modes}>{mode => <option value={mode}>{mode === 'Timeline' ? 'Agenda' : mode}</option>}</For></select></label>
      </div>
      <details class="calendar-settings"><summary>View options</summary>
      <Show when={scheduleView() === 'Week' || scheduleView() === 'Day'}><label class="calendar-hour-option"><input type="checkbox" checked={showHours()} onChange={event => setShowHours(event.currentTarget.checked)} /> Show hourly timeline</label></Show>
      <label class="calendar-zone">Timezone <input aria-label="Calendar timezone" value={zone()} list="calendar-timezones" disabled={isEventModalOpen()} onChange={event => void selectZone(event.currentTarget.value)} /></label>
      <datalist id="calendar-timezones"><For each={['UTC', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'America/New_York', 'Europe/London']}>{value => <option value={value} />}</For></datalist>
      </details>
    </div>
    <Show when={loadError()}><p role="alert" class="calendar-message">{loadError()} <button class="btn-secondary" onClick={() => void loadData()}>Retry</button></p></Show>
    <Show when={loading()}><p role="status" class="calendar-message">Loading calendar…</p></Show>
    <div class="calendar-layout" aria-busy={loading()}>
      <details class="calendar-backlog"><summary>Unscheduled tasks ({backlogTasks().length})</summary><p>Choose a task to see details or schedule it.</p>
        <div class="calendar-backlog-items"><For each={backlogTasks()} fallback={<p>No unscheduled tasks.</p>}>{task => <button type="button" class="calendar-item calendar-entry" onClick={() => setSelectedItem({ kind: 'Task', id: task.id })}><strong>{task.title}</strong></button>}</For></div>
      </details>
      <section class="calendar-matrix" aria-label={`${scheduleView()} calendar`}>
        <Show when={scheduleView() === 'Month'}>
          <div class="calendar-month-head"><For each={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}>{day => <span>{day}</span>}</For></div>
          <div class="calendar-month"><For each={days()}>{day => <div class="calendar-month-day" data-date={dateKey(day)} classList={{ 'calendar-outside': day.getMonth() !== anchor().getMonth(), 'calendar-today': dateKey(day) === dateKey(zonedDate(new Date())) }}>
            <button class="calendar-date" aria-label={`View ${formatDay(day)}`} onClick={() => { setAnchor(day); setScheduleView('Day'); }}>{day.getDate()}</button>
            <For each={itemsOnDay(items(), day)}>{itemCard}</For>
          </div>}</For></div>
        </Show>
        <Show when={scheduleView() === 'Timeline' || ((scheduleView() === 'Week' || scheduleView() === 'Day') && !showHours())}>
          <div class="calendar-agenda" classList={{ 'calendar-week-agenda': scheduleView() === 'Week' }}><For each={days()}>{day => <section data-date={dateKey(day)}><Show when={scheduleView() !== 'Day'}><h3 classList={{ 'calendar-today-label': dateKey(day) === dateKey(zonedDate(new Date())) }}>{formatDay(day)}</h3></Show>
            <For each={itemsOnDay(items(), day)} fallback={<p>No scheduled items.</p>}>{itemCard}</For>
          </section>}</For></div>
        </Show>
        <Show when={(scheduleView() === 'Week' || scheduleView() === 'Day') && showHours()}>
          <div class="calendar-time-scroll" tabindex="0" role="region" aria-label="Hourly calendar">
          <div class="calendar-time-head" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}><span>Time</span>
            <For each={days()}>{day => <div classList={{ 'calendar-today': dateKey(day) === dateKey(zonedDate(new Date())) }}>{formatDay(day)}
              <For each={itemsOnDay(items(), day).filter(item => item.allDay)}>{itemCard}</For>
            </div>}</For>
          </div>
          <div class="calendar-time-grid" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}>
            <div class="calendar-hours"><For each={Array.from({ length: 24 }, (_, index) => index)}>{hour => <span>{String(hour).padStart(2, '0')}:00</span>}</For></div>
            <For each={days()}>{day => <div class="calendar-time-day" data-date={dateKey(day)}><For each={timedLayout(items(), day)}>{row => <div class="calendar-timed-item" style={{ top: `${row.top}px`, height: `${row.height}px`, left: `${row.lane / row.lanes * 100}%`, width: `${100 / row.lanes}%` }}>{itemCard(row.item)}</div>}</For></div>}</For>
          </div></div>
        </Show>
        <Show when={!loading() && !loadError() && visibleItems().length === 0}><p class="calendar-message" role="status">No events or dated tasks in this period.</p></Show>
      </section>
    </div>
      <Show when={selectedItem() && (detailEvent() || detailTask())}>
        <div class="calendar-detail-backdrop" onClick={event => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <section class="calendar-detail" ref={element => focusScope(element, () => setSelectedItem(null))}>
            <header><span>{selectedItem()?.kind}</span><button type="button" class="btn-ghost-icon" aria-label="Close item details" onClick={() => setSelectedItem(null)}><X size={18} /></button></header>
            <h2>{detailEvent()?.title || detailTask()?.title}</h2>
            <dl>
              <dt>Space</dt><dd>{getSpaceInfo(detailEvent()?.space_id || detailTask()?.space_id)}</dd>
              <Show when={detailEvent()}>{event => <>
                <dt>When</dt><dd>{formatDay(zonedDate(event().start_at))}{event().is_all_day ? ' · All day' : ` · ${formatTime(zonedDate(event().start_at))}` }<br />
                  {event().is_all_day ? `Through ${formatDay(addDays(zonedDate(event().end_at), -1))}` : `Until ${formatDay(zonedDate(event().end_at))} · ${formatTime(zonedDate(event().end_at))}`}<br /><small>{zone()}</small></dd>
                <Show when={event().linked_task_id}><dt>Linked task</dt><dd>{tasks().find(task => task.id === event().linked_task_id)?.title || 'Linked task'}</dd></Show>
              </>}</Show>
              <Show when={detailTask()}>{task => <>
                <dt>Status</dt><dd>{task().status.replaceAll('_', ' ')}</dd><dt>Priority</dt><dd>{task().priority}</dd>
                <Show when={task().planned_date}><dt>Planned</dt><dd>{task().planned_date?.slice(0, 10)}</dd></Show>
                <Show when={task().due_date}><dt>Due</dt><dd>{task().due_date?.slice(0, 10)}</dd></Show>
                <Show when={task().estimated_minutes}><dt>Duration</dt><dd>{task().estimated_minutes} min</dd></Show>
              </>}</Show>
            </dl>
            <Show when={detailEvent()?.description || detailTask()?.description}><p class="calendar-detail-description">{detailEvent()?.description || detailTask()?.description}</p></Show>
            <footer>
              <Show when={detailEvent()}>{event => <button type="button" class="btn-primary" onClick={() => { const current = event(); setSelectedItem(null); editEvent(current); }}>Edit event</button>}</Show>
              <Show when={detailTask()}>{task => <>
                <button type="button" class="btn-secondary" onClick={() => { const current = task(); setSelectedItem(null); setTaskToEdit(current); }}>Edit task</button>
                <Show when={task().status !== 'done' && task().status !== 'cancelled'}><button type="button" class="btn-primary" onClick={() => { const current = task(); setSelectedItem(null); openEvent(current); }}>Schedule task</button></Show>
              </>}</Show>
            </footer>
          </section>
        </div>
      </Show>
      <TaskModal isOpen={!!taskToEdit()} taskToEdit={taskToEdit()} onClose={() => setTaskToEdit(null)} onSaved={task => {
        generation++; setLoading(false); setTasks(previous => previous.map(item => item.id === task.id ? task : item)); setTaskToEdit(null);
      }} onDeleted={id => { setTasks(previous => previous.filter(task => task.id !== id)); setTaskToEdit(null); void loadData(); }} />
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
          onClick={(e) => { if (e.target === e.currentTarget && !eventSaving()) setIsEventModalOpen(false); }}
        >
          <div class="modal-card" ref={el => focusScope(el, () => { if (!eventSaving()) setIsEventModalOpen(false); })} style={{
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
                <h3 style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)', margin: 0 }}>{editingEvent() ? 'Edit Event' : 'Schedule Event'}</h3>
              </div>
              <button
                aria-label="Close event dialog" disabled={eventSaving()} onClick={() => setIsEventModalOpen(false)}
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
                    onChange={e => { setEventSpaceId(e.currentTarget.value); setEventTaskId(''); }}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="">General</option>
                    <For each={spaces()}>
                      {(sp) => <option value={sp.id}>{sp.name}</option>}
                    </For>
                  </select>
                </div>

                <div>
                  <label for="event-date" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>DATE</label>
                  <input id="event-date" type="date" required value={eventDate()} onInput={e => { setEventDate(e.currentTarget.value); if (eventEndDate() < e.currentTarget.value) setEventEndDate(e.currentTarget.value); }} />
                </div>
              </div>

              <label for="event-end-date">End date<input id="event-end-date" type="date" required value={eventEndDate()} onInput={event => setEventEndDate(event.currentTarget.value)} /></label>
              <div><label for="event-task">Linked task</label><select id="event-task" style={{ width: '100%' }} value={eventTaskId()} onChange={event => { setEventTaskId(event.currentTarget.value); const task = tasks().find(task => task.id === event.currentTarget.value); if (task) setEventSpaceId(task.space_id); }}><option value="">No linked task</option><For each={tasks()}>{task => <option value={task.id}>{task.title}</option>}</For></select></div>
              <label for="event-all-day"><input id="event-all-day" type="checkbox" aria-label="All day" checked={eventAllDay()} onChange={event => setEventAllDay(event.currentTarget.checked)} /> All day</label>
              <Show when={!eventAllDay()}>
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
              </Show>
              <small>Times use {zone()}. All-day end dates include the selected day.</small>

              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px', "margin-top": '8px' }}>
                <Show when={editingEvent()}><button type="button" class="btn-ghost-danger" disabled={eventSaving()} onClick={() => void removeEvent()}>Delete event</button></Show>
                <button
                  type="button"
                  disabled={eventSaving()}
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
