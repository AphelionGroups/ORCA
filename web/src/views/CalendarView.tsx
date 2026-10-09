import { createEffect, createSignal, For, Show, onCleanup, untrack } from 'solid-js';
import type { Component } from 'solid-js';
import { Calendar, Plus, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-solid';
import { api } from '../services/api';
import type { CalendarEvent, Task, Space } from '../services/api';
import { createRequestGate } from '../services/requestGate';
import { focusScope } from '../components/focusScope';
import { addDays, calendarDays, layoutDayEvents, overlapsDay, shiftCalendar, wallTimeToInstant, zonedParts } from '../services/calendarDates';
import type { CalendarMode } from '../services/calendarDates';

interface CalendarViewProps { onOpenQuickCapture: () => void; onNavigate?: (route: string, spaceId?: string | null) => void; }
const initialZone = () => {
  try { const zone = Intl.DateTimeFormat().resolvedOptions().timeZone; new Intl.DateTimeFormat('en', { timeZone: zone }); return zone; }
  catch { return 'UTC'; }
};
export const CalendarView: Component<CalendarViewProps> = () => {
  const eventRequests = createRequestGate(), referenceRequests = createRequestGate();
  let alive = true;
  let zoneChanged = false;
  onCleanup(() => { alive = false; eventRequests.invalidate(); referenceRequests.invalidate(); });
  const [zone, setZone] = createSignal(initialZone());
  const [anchor, setAnchor] = createSignal(zonedParts(new Date(), zone()).date);
  const [mode, setMode] = createSignal<CalendarMode>('Week');
  const [spaceFilter, setSpaceFilter] = createSignal('');
  const [events, setEvents] = createSignal<CalendarEvent[]>([]);
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [modal, setModal] = createSignal(false);
  const [editing, setEditing] = createSignal<CalendarEvent | null>(null);
  const [title, setTitle] = createSignal('');
  const [spaceId, setSpaceId] = createSignal('');
  const [taskId, setTaskId] = createSignal('');
  const [startDay, setStartDay] = createSignal(anchor());
  const [endDay, setEndDay] = createSignal(anchor());
  const [startTime, setStartTime] = createSignal('10:00');
  const [endTime, setEndTime] = createSignal('11:00');
  const [allDay, setAllDay] = createSignal(false);
  const days = () => calendarDays(anchor(), mode());
  const activeTasks = () => tasks().filter(task => task.status !== 'done' && task.status !== 'cancelled' && (!spaceFilter() || task.space_id === spaceFilter()));
  const spaceName = (id?: string) => spaces().find(space => space.id === id)?.name || 'General';
  const labelDay = (day: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const timeLabel = (event: CalendarEvent) => event.is_all_day ? 'All day' : `${zonedParts(event.start_at, zone()).time} – ${zonedParts(event.end_at, zone()).time}`;
  const dayEvents = (day: string) => events().filter(event => overlapsDay(event, day, zone()));
  const loadEvents = async () => {
    const request = eventRequests.begin();
    const visible = days();
    setLoading(true);
    try {
      const result = await api.getEvents({ start: wallTimeToInstant(visible[0], '00:00', zone()), end: wallTimeToInstant(addDays(visible.at(-1)!, 1), '00:00', zone()), space_id: spaceFilter() || undefined });
      if (eventRequests.isCurrent(request)) setEvents(result);
    } catch (failure) { if (eventRequests.isCurrent(request)) setError(failure instanceof Error ? failure.message : 'Could not load calendar'); }
    finally { if (eventRequests.isCurrent(request)) setLoading(false); }
  };
  createEffect(() => { anchor(); mode(); spaceFilter(); zone(); untrack(loadEvents); });
  createEffect(() => {
    const request = referenceRequests.begin();
    Promise.all([api.getSpaces(), api.getTasks(), api.getPreferences()]).then(([loadedSpaces, loadedTasks, preferences]) => {
      if (!referenceRequests.isCurrent(request)) return;
      setSpaces(loadedSpaces); setTasks(loadedTasks);
      if (preferences.calendar_timezone && !zoneChanged) { setZone(preferences.calendar_timezone); setAnchor(zonedParts(new Date(), preferences.calendar_timezone).date); }
    }).catch(failure => { if (referenceRequests.isCurrent(request)) setError(failure instanceof Error ? failure.message : 'Could not load tasks'); });
  });
  const openNew = (day = anchor(), task?: Task) => {
    setEditing(null); setTitle(task?.title || ''); setTaskId(task?.id || '');
    setSpaceId(task?.space_id || spaceFilter() || spaces()[0]?.id || '');
    setStartDay(day); setEndDay(day); setStartTime('10:00');
    const duration = Math.max(15, Math.min(720, task?.estimated_minutes || 60));
    const end = 600 + duration;
    setEndTime(`${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`);
    setAllDay(false); setError(''); setModal(true);
  };
  const openEvent = (event: CalendarEvent) => {
    const start = zonedParts(event.start_at, zone()), end = zonedParts(event.end_at, zone());
    setEditing(event); setTitle(event.title); setTaskId(event.linked_task_id || ''); setSpaceId(event.space_id || '');
    setStartDay(start.date); setEndDay(event.is_all_day ? addDays(end.date, -1) : end.date);
    setStartTime(start.time); setEndTime(end.time); setAllDay(event.is_all_day); setError(''); setModal(true);
  };
  const save = async (event: Event) => {
    event.preventDefault(); if (saving() || !title().trim()) return;
    setSaving(true); setError('');
    try {
      const start = wallTimeToInstant(startDay(), allDay() ? '00:00' : startTime(), zone());
      const end = wallTimeToInstant(allDay() ? addDays(endDay(), 1) : endDay(), allDay() ? '00:00' : endTime(), zone());
      if (Date.parse(end) <= Date.parse(start)) throw new Error('End time must be after start time');
      const data = { title: title().trim(), space_id: spaceId() || null, linked_task_id: taskId() || null, start_at: start, end_at: end, is_all_day: allDay() };
      const existing = editing();
      if (existing) await api.updateEvent(existing.id, { ...data, expected_updated_at: existing.updated_at });
      else await api.createEvent({ ...data, space_id: data.space_id || undefined, linked_task_id: data.linked_task_id || undefined });
      if (!alive) return;
      setModal(false); await loadEvents();
    } catch (failure) { if (alive) setError(failure instanceof Error ? failure.message : 'Could not save event'); }
    finally { if (alive) setSaving(false); }
  };
  const remove = async () => {
    const event = editing(); if (!event || saving()) return;
    setSaving(true);
    try { await api.deleteEvent(event.id); if (alive) { setModal(false); await loadEvents(); } }
    catch (failure) { if (alive) setError(failure instanceof Error ? failure.message : 'Could not delete event'); }
    finally { if (alive) setSaving(false); }
  };
  const selectZone = async (value: string) => {
    zoneChanged = true;
    try { new Intl.DateTimeFormat('en', { timeZone: value }); await api.updatePreferences(value); if (alive) setZone(value); }
    catch (failure) { if (alive) setError(failure instanceof Error ? failure.message : 'Enter a valid IANA timezone'); }
  };
  const eventButton = (event: CalendarEvent) => <button class="calendar-event-card" onClick={() => openEvent(event)}><strong>{event.title}</strong><span>{timeLabel(event)}</span><small>{spaceName(event.space_id)}{event.linked_task_id ? ' · Task session' : ''}</small></button>;
  return <div class="calendar-page">
    <header class="orca-header"><div class="breadcrumb-title"><Calendar size={17} /><span>Calendar</span></div><div class="header-actions"><button class="btn-secondary" aria-label="Refresh events" onClick={loadEvents}><RotateCcw size={14} /></button><button class="btn-primary" onClick={() => openNew()}><Plus size={14} /> Add Event</button></div></header>
    <Show when={error() && !modal()}><div role="alert" class="operation-error">{error()}<button class="btn-secondary" onClick={() => setError('')}>Dismiss</button></div></Show>
    <div class="calendar-ribbon"><div class="calendar-nav"><button class="btn-secondary" aria-label="Previous period" onClick={() => setAnchor(shiftCalendar(anchor(), mode(), -1))}><ChevronLeft size={16} /></button><button class="btn-secondary" onClick={() => setAnchor(zonedParts(new Date(), zone()).date)}>Today</button><button class="btn-secondary" aria-label="Next period" onClick={() => setAnchor(shiftCalendar(anchor(), mode(), 1))}><ChevronRight size={16} /></button><strong>{mode() === 'Month' ? anchor().slice(0, 7) : `${labelDay(days()[0])}${days().length > 1 ? ` – ${labelDay(days().at(-1)!)}` : ''}`}</strong></div>
      <div class="calendar-nav"><label>Space <select aria-label="Calendar space" value={spaceFilter()} onChange={event => setSpaceFilter(event.currentTarget.value)}><option value="">All Spaces</option><For each={spaces()}>{space => <option value={space.id}>{space.name}</option>}</For></select></label><label>Timezone <input aria-label="Calendar timezone" list="calendar-timezones" value={zone()} onChange={event => selectZone(event.currentTarget.value)} disabled={modal()} /></label><datalist id="calendar-timezones"><For each={['UTC', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'America/New_York', 'Europe/London']}>{value => <option value={value} />}</For></datalist></div>
      <div class="calendar-nav" role="group" aria-label="Calendar view"><For each={['Day', 'Week', 'Month', 'Timeline'] as CalendarMode[]}>{value => <button class="btn-secondary" aria-pressed={mode() === value} onClick={() => setMode(value)}>{value}</button>}</For></div>
    </div>
    <div class="calendar-layout"><aside class="calendar-backlog"><h3>Tasks to schedule</h3><p>Schedule another session without changing the task status.</p><Show when={activeTasks().length} fallback={<p>No active tasks.</p>}><For each={activeTasks()}>{task => <div class="calendar-task-card"><strong>{task.title}</strong><small>{spaceName(task.space_id)} · {task.estimated_minutes ? `${task.estimated_minutes} min estimate` : 'No estimate'}</small><button class="btn-secondary" onClick={() => openNew(anchor(), task)}>Schedule task</button></div>}</For></Show></aside>
      <section class="calendar-grid" aria-label="Calendar grid, scroll horizontally" tabindex={0} aria-busy={loading()}>
        <Show when={mode() !== 'Timeline'} fallback={<div class="calendar-agenda"><Show when={events().length} fallback={<p>No events in this period.</p>}><For each={events()}>{event => <div><small>{labelDay(zonedParts(event.start_at, zone()).date)}</small>{eventButton(event)}</div>}</For></Show></div>}>
          <Show when={mode() === 'Month'} fallback={<div class="calendar-days" style={{ 'grid-template-columns': `repeat(${days().length}, minmax(120px, 1fr))` }}><For each={days()}>{day => <div class="calendar-day"><div class="calendar-day-heading"><strong>{labelDay(day)}</strong><button class="btn-secondary" aria-label={`Add event ${day}`} onClick={() => openNew(day)}><Plus size={14} /></button></div><div class="calendar-all-day"><For each={dayEvents(day).filter(event => event.is_all_day)}>{eventButton}</For></div><div class="calendar-hours"><div class="calendar-time-track"><For each={Array.from({ length: 24 }, (_, hour) => hour)}>{hour => <div class="calendar-hour" style={{ top: `${hour * 60}px` }}><time>{String(hour).padStart(2, '0')}:00</time></div>}</For><For each={layoutDayEvents(events(), day, zone())}>{entry => <div class="calendar-positioned-event" style={{ top: `${entry.start}px`, height: `${Math.max(24, entry.end - entry.start)}px`, left: `calc(36px + (100% - 40px) * ${entry.lane / entry.lanes})`, width: `calc((100% - 40px) / ${entry.lanes})` }}>{eventButton(entry.event)}</div>}</For></div></div></div>}</For></div>}>
            <div class="calendar-month"><For each={days()}>{day => <div class="calendar-month-day" classList={{ 'calendar-outside-month': day.slice(0, 7) !== anchor().slice(0, 7), 'calendar-today': day === zonedParts(new Date(), zone()).date }}><div class="calendar-day-heading"><strong>{labelDay(day)}</strong><button class="btn-secondary" aria-label={`Add event ${day}`} onClick={() => openNew(day)}><Plus size={14} /></button></div><For each={dayEvents(day)}>{eventButton}</For></div>}</For></div>
          </Show>
        </Show>
      </section>
    </div>
    <Show when={modal()}><div class="calendar-modal-overlay" onClick={event => { if (event.target === event.currentTarget && !saving()) setModal(false); }}><div class="modal-card calendar-event-modal" ref={element => focusScope(element, () => { if (!saving()) setModal(false); })} role="dialog" aria-modal="true" aria-labelledby="calendar-event-title"><div class="calendar-day-heading"><h3 id="calendar-event-title">{editing() ? 'Edit Event' : 'Schedule Event'}</h3><button class="btn-secondary" aria-label="Close schedule dialog" disabled={saving()} onClick={() => setModal(false)}><X size={16} /></button></div>
      <Show when={error()}><p class="operation-error" role="alert">{error()}</p></Show><form onSubmit={save} class="calendar-event-form">
        <label>Event title<input required autofocus value={title()} onInput={event => setTitle(event.currentTarget.value)} /></label>
        <label>Space<select value={spaceId()} onChange={event => setSpaceId(event.currentTarget.value)}><option value="">General</option><For each={spaces()}>{space => <option value={space.id}>{space.name}</option>}</For></select></label>
        <label>Linked task<select value={taskId()} onChange={event => { setTaskId(event.currentTarget.value); const task = tasks().find(task => task.id === event.currentTarget.value); if (task) setSpaceId(task.space_id || ''); }}><option value="">No linked task</option><For each={tasks()}>{task => <option value={task.id}>{task.title}</option>}</For></select></label>
        <label class="calendar-checkbox"><input type="checkbox" checked={allDay()} onChange={event => setAllDay(event.currentTarget.checked)} /> All day</label>
        <div class="calendar-form-pair"><label>Start date<input type="date" required value={startDay()} onInput={event => setStartDay(event.currentTarget.value)} /></label><label>End date<input type="date" required value={endDay()} onInput={event => setEndDay(event.currentTarget.value)} /></label></div>
        <Show when={!allDay()}><div class="calendar-form-pair"><label>Start time<input type="time" required value={startTime()} onInput={event => setStartTime(event.currentTarget.value)} /></label><label>End time<input type="time" required value={endTime()} onInput={event => setEndTime(event.currentTarget.value)} /></label></div></Show>
        <small>Times use {zone()}. All-day end dates include the selected day.</small><div class="calendar-nav"><Show when={editing()}><button type="button" class="btn-secondary" disabled={saving()} onClick={remove}>Delete event</button></Show><button type="submit" class="btn-primary" disabled={saving()}>{saving() ? 'Saving…' : 'Save event'}</button></div>
      </form></div></div></Show>
  </div>;
};
