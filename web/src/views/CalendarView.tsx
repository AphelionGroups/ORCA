import { TaskContext } from '../components/TaskContext';
import { getCurrentUser } from '../services/user';
import { sessionSlot, sessionConflicts, tasksToSchedule } from '../services/calendarPlanning';
import '../styles/calendarPlanning.css';
import { PageOptions } from '../components/PageOptions';
import { useDataRefresh } from '../services/dataRefresh';
import { focusScope } from '../components/focusScope';
import { TaskModal } from '../components/TaskModal';
import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, onCleanup, For, Show } from 'solid-js';
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, Globe, X, ListTodo, Flag, CalendarDays, GripHorizontal } from 'lucide-solid';
import { api } from '../services/api';
import type { CalendarEvent, Task, Space } from '../services/api';
import { addDays, dateKey, calendarDays, moveCalendar, calendarItems, itemsOnDay, taskDate, timedLayout } from '../services/calendar';
import type { CalendarMode, CalendarItem } from '../services/calendar';
import { wallTimeToInstant, zonedParts } from '../services/calendarDates';

interface CalendarViewProps {
  onOpenQuickCapture: () => void;
  onNavigate?: (route: string, spaceId?: string | null) => void;
}
const modes: CalendarMode[] = ['Day', 'Week', 'Month'];
const formatDay = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const CalendarView: Component<CalendarViewProps> = (_props) => {
  const identity = getCurrentUser();
  const preferenceKey = `orca:calendar-view:v1:${identity.workspace_id}:${identity.id}`;
  let initial: { view?: CalendarMode; hours?: boolean } = {};
  try { initial = JSON.parse(localStorage.getItem(preferenceKey) || '{}') || {}; } catch { /* Use defaults. */ }
  const compactQuery = window.matchMedia('(max-width: 767px)');
  const [compact, setCompact] = createSignal(compactQuery.matches);
  const [taskPickerOpen, setTaskPickerOpen] = createSignal(false);
  const [timezoneOpen, setTimezoneOpen] = createSignal(false);
  const [timezoneDraft, setTimezoneDraft] = createSignal('');
  const [timezoneSaving, setTimezoneSaving] = createSignal(false);
  let timezoneControl!: HTMLDivElement;
  let timezoneTrigger!: HTMLButtonElement;
  const closeTimezone = () => { setTimezoneOpen(false); timezoneTrigger?.focus(); };
  onMount(() => {
    const resize = (event: MediaQueryListEvent) => { setCompact(event.matches); if (!event.matches) setTaskPickerOpen(false); };
    const outside = (event: PointerEvent) => { if (timezoneOpen() && !timezoneSaving() && !timezoneControl?.contains(event.target as Node)) setTimezoneOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && timezoneOpen() && !timezoneSaving()) { event.preventDefault(); closeTimezone(); } };
    compactQuery.addEventListener('change', resize); document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    onCleanup(() => { compactQuery.removeEventListener('change', resize); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); });
  });
  const [spaceFilter, setSpaceFilter] = createSignal('all');
  const [zone, setZone] = createSignal(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const zonedDate = (instant: string | Date) => {
    const parts = zonedParts(instant, zone());
    return new Date(`${parts.date}T${parts.time}`);
  };
  const [scheduleView, setScheduleView] = createSignal<CalendarMode>(modes.includes(initial.view as CalendarMode) ? initial.view! : window.matchMedia('(max-width: 767px)').matches ? 'Day' : 'Week');
  const [showHours, setShowHours] = createSignal(initial.hours === true);
  const persistView = () => { try { localStorage.setItem(preferenceKey, JSON.stringify({ view: scheduleView(), hours: showHours() })); } catch { /* Preferences are optional. */ } };
  const changeView = (view: CalendarMode) => { setScheduleView(view); persistView(); };
  const [backlogFilter, setBacklogFilter] = createSignal('today');
  const [clockNow, setClockNow] = createSignal(new Date());
  const [sessionBusy, setSessionBusy] = createSignal(false);
  const [sessionError, setSessionError] = createSignal('');
  const [undoChange, setUndoChange] = createSignal<{ before: CalendarEvent; after: CalendarEvent } | null>(null);
  const [resizePreview, setResizePreview] = createSignal<{ id: string; end: string } | null>(null);
  const [dropPreview, setDropPreview] = createSignal<{ day: string; minute: number } | null>(null);
  let resizing: { pointer: number; y: number; event: CalendarEvent; handle: HTMLElement } | null = null;
  let suppressClick = false;
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
  const loadData = async (background = false) => {
    const request = ++generation;
    if (!background) setLoading(true); setLoadError('');
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
    const clock = window.setInterval(() => setClockNow(new Date()), 30000);
    onCleanup(() => clearInterval(clock));
    void loadData();
    void api.getPreferences().then(preferences => {
      if (!disposed && preferences.calendar_timezone) {
        setZone(preferences.calendar_timezone); setAnchor(zonedDate(new Date()));
      }
    }).catch(error => { if (!disposed) setLoadError(error instanceof Error ? error.message : 'Unable to load calendar preferences.'); });
  });
  useDataRefresh(() => loadData(true), () => !loading() && !isEventModalOpen() && !selectedItem() && !taskToEdit() && !sessionBusy() && !resizePreview() && !taskPickerOpen() && !timezoneOpen());
  const selectZone = async (value: string) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      await api.updatePreferences(value);
      if (!disposed) { setZone(value); setAnchor(zonedDate(new Date())); }
      return true;
    } catch (error) { if (!disposed) setLoadError(error instanceof Error ? error.message : 'Enter a valid timezone.'); return false; }
  };
  const matchesSpace = (spaceId?: string) => spaceFilter() === 'all' || spaceId === spaceFilter();
  const items = createMemo(() => calendarItems(events().map(event => {
    const start = zonedDate(event.start_at), end = zonedDate(event.end_at);
    // Keep repeated-hour sessions visible when daylight saving time ends.
    const displayEnd = end > start ? end : new Date(start.getTime() + Date.parse(event.end_at) - Date.parse(event.start_at));
    return { ...event, start_at: start.toISOString(), end_at: displayEnd.toISOString() };
  }), tasks()).filter(item => matchesSpace(item.spaceId)));
  const backlogTasks = createMemo(() => tasksToSchedule(tasks(), events(), dateKey(zonedDate(clockNow())), backlogFilter()).filter(task => matchesSpace(task.space_id)));
  const dayItems = (day: Date) => itemsOnDay(items(), day);
  const dayMinutes = (day: Date) => timedLayout(items(), day).reduce((sum, row) => sum + (row.end - row.start) / 60000, 0);
  const busyLabel = (day: Date) => { const minutes = dayMinutes(day); return minutes ? `${Math.round(minutes / 6) / 10}h scheduled` : 'No sessions'; };
  const hasOverlaps = (day: Date) => timedLayout(items(), day).some(row => row.lanes > 1);
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
  const eventFor = (item: CalendarItem) => events().find(event => event.id === item.sourceId);
  const writeSession = async (before: CalendarEvent, slot: { start_at: string; end_at: string }, undo = false) => {
    if (sessionBusy()) return;
    setSessionBusy(true); setSessionError('');
    try {
      const after = await api.updateEvent(before.id, { ...slot, expected_updated_at: before.updated_at });
      if (disposed) return;
      generation++; setLoading(false); setEvents(previous => previous.map(event => event.id === after.id ? after : event));
      setUndoChange(undo ? null : { before, after });
    } catch (error) { if (!disposed) { setSessionError(error instanceof Error ? error.message : 'Unable to change session.'); void loadData(true); } }
    finally { if (!disposed) setSessionBusy(false); }
  };
  const openSlot = (day: Date, minute: number, task?: Task) => {
    try {
      const slot = sessionSlot(dateKey(day), minute, zone(), task?.estimated_minutes || 60);
      openEvent(task); setEventDate(dateKey(zonedDate(slot.start_at))); setEventEndDate(dateKey(zonedDate(slot.end_at)));
      setEventStartHour(zonedParts(slot.start_at, zone()).time); setEventEndHour(zonedParts(slot.end_at, zone()).time);
    } catch (error) { setSessionError(error instanceof Error ? error.message : 'Choose a valid time.'); }
  };
  const slotMinute = (element: HTMLElement, y: number) => Math.max(0, Math.min(1425, Math.round((y - element.getBoundingClientRect().top) / 48 * 60 / 15) * 15));
  const dragOver = (event: DragEvent, day: Date) => { if (sessionBusy()) return; event.preventDefault(); setDropPreview({ day: dateKey(day), minute: slotMinute(event.currentTarget as HTMLElement, event.clientY) }); };
  const dropSession = (event: DragEvent, day: Date) => {
    event.preventDefault(); setDropPreview(null);
    if (sessionBusy()) return;
    try {
      const payload = JSON.parse(event.dataTransfer?.getData('application/x-orca-calendar') || 'null');
      const minute = slotMinute(event.currentTarget as HTMLElement, event.clientY);
      if (payload?.kind === 'task') { const task = tasks().find(task => task.id === payload.id); if (task) openSlot(day, minute, task); }
      if (payload?.kind === 'event') {
        const current = events().find(event => event.id === payload.id); if (!current || current.is_all_day) return;
        const slot = sessionSlot(dateKey(day), minute, zone(), (Date.parse(current.end_at) - Date.parse(current.start_at)) / 60000);
        void writeSession(current, slot);
      }
    } catch (error) { setSessionError(error instanceof Error ? error.message : 'Unable to move this item.'); }
  };
  const startResize = (event: PointerEvent, item: CalendarItem) => {
    const current = eventFor(item);
    if (!current || sessionBusy() || event.button !== 0 || !event.isPrimary) return;
    event.stopPropagation(); event.preventDefault();
    const handle = event.currentTarget as HTMLElement; handle.setPointerCapture(event.pointerId);
    resizing = { pointer: event.pointerId, y: event.clientY, event: current, handle }; setResizePreview({ id: current.id, end: current.end_at });
  };
  const updateResize = (event: PointerEvent) => {
    if (!resizing || resizing.pointer !== event.pointerId) return;
    const minutes = Math.round((event.clientY - resizing.y) / 48 * 60 / 15) * 15;
    const end = Math.max(Date.parse(resizing.event.start_at) + 15 * 60000, Date.parse(resizing.event.end_at) + minutes * 60000);
    setResizePreview({ id: resizing.event.id, end: new Date(end).toISOString() });
  };
  const cancelResize = () => { const current = resizing; if (!current) return; resizing = null; setResizePreview(null); suppressClick = true; window.setTimeout(() => { suppressClick = false; }, 500); if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer); };
  const finishResize = (event: PointerEvent) => {
    if (!resizing || resizing.pointer !== event.pointerId) return;
    const before = resizing.event, end = resizePreview()?.end; cancelResize();
    if (end && end !== before.end_at) void writeSession(before, { start_at: before.start_at, end_at: end });
  };
  onMount(() => { const resetSuppression = () => { if (!resizing) suppressClick = false; }; window.addEventListener('pointerdown', resetSuppression, true); const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelResize(); }; window.addEventListener('keydown', escape); window.addEventListener('blur', cancelResize); onCleanup(() => { window.removeEventListener('pointerdown', resetSuppression, true); window.removeEventListener('keydown', escape); window.removeEventListener('blur', cancelResize); cancelResize(); }); });
  const eventWarning = createMemo(() => {
    if (!isEventModalOpen() || eventAllDay()) return 0;
    try { return sessionConflicts(events(), { id: editingEvent()?.id, start_at: wallTimeToInstant(eventDate(), eventStartHour(), zone()), end_at: wallTimeToInstant(eventEndDate(), eventEndHour(), zone()) }).length; } catch { return 0; }
  });
  const taskChoices = () => <>
    <label class="calendar-backlog-filter">Show<select aria-label="Tasks to schedule filter" value={backlogFilter()} onChange={event => setBacklogFilter(event.currentTarget.value)}><option value="today">Today</option><option value="overdue">Overdue</option><option value="all">All open tasks</option></select></label>
    <div class="calendar-backlog-items"><For each={backlogTasks()} fallback={<p>No tasks in this filter.</p>}>{task => <button type="button" class="calendar-item calendar-entry" draggable={!compact() && !sessionBusy()} onDragStart={event => event.dataTransfer?.setData('application/x-orca-calendar', JSON.stringify({ kind: 'task', id: task.id }))} onDragEnd={() => setDropPreview(null)} onClick={() => { setTaskPickerOpen(false); setSelectedItem({ kind: 'Task', id: task.id }); }}><ListTodo size={14} /><strong>{task.title}<TaskContext task={task} /></strong><span class="calendar-entry-meta">{task.due_date ? `Due ${task.due_date.slice(0, 10)}` : task.planned_date ? `Planned ${task.planned_date.slice(0, 10)}` : 'No date'}</span></button>}</For></div>
  </>;
  const itemCard = (item: CalendarItem) => <button type="button" class="calendar-item calendar-entry" data-category={item.category} draggable={item.kind === 'Event' && !item.allDay && !sessionBusy()} onDragStart={event => { event.dataTransfer?.setData('application/x-orca-calendar', JSON.stringify({ kind: 'event', id: item.sourceId })); }} onDragEnd={() => setDropPreview(null)} classList={{ 'calendar-item-done': item.status === 'done' }}
    aria-label={item.title} onClick={() => { if (!suppressClick) setSelectedItem({ kind: item.kind, id: item.sourceId }); }}>
    <span class="calendar-entry-kind" aria-hidden="true">{item.category === 'deadline' ? <Flag size={12} /> : item.kind === 'Task' || item.category === 'session' ? <ListTodo size={12} /> : <CalendarDays size={12} />}</span><strong>{item.title}</strong>
    <span class="calendar-entry-meta">{item.allDay ? item.category === 'deadline' ? 'Deadline' : item.category === 'planned' ? 'Planned' : 'All day' : `${formatTime(item.start)} – ${formatTime(item.end)}${item.category === 'session' ? ' · Task session' : ''}`}</span>
  </button>;

  return <div class="calendar-workspace">
    <header class="orca-header"><div class="header-breadcrumbs"><div class="breadcrumb-title"><Calendar size={17} /><span>Calendar</span></div></div>
      <div class="header-actions"><PageOptions onRefresh={() => loadData()} busy={loading()} />
        <button class="btn-primary" onClick={() => openEvent()}><Plus size={14} /> Add Event</button></div>
    </header>
    <div class="calendar-ribbon">
      <div><h2 aria-live="polite" class="calendar-period">{periodLabel()}</h2>
        <div class="calendar-controls"><button class="btn-secondary" aria-label="Previous period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), -1))}><ChevronLeft size={16} /></button>
          <button class="btn-secondary" onClick={() => setAnchor(zonedDate(new Date()))}>Today</button><input class="calendar-jump-date" aria-label="Jump to date" type="date" value={dateKey(anchor())} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.currentTarget.value)) setAnchor(new Date(`${event.currentTarget.value}T12:00`)); }} />
          <button class="btn-secondary" aria-label="Next period" onClick={() => setAnchor(moveCalendar(anchor(), scheduleView(), 1))}><ChevronRight size={16} /></button></div>
      </div>
      <div class="calendar-filters">
        <label>Space<select aria-label="Calendar space" value={spaceFilter()} onChange={event => setSpaceFilter(event.currentTarget.value)}><option value="all">All Spaces</option><For each={spaces()}>{space => <option value={space.id}>{space.name}</option>}</For></select></label>
        <label>View<select aria-label="Calendar view" value={scheduleView()} onChange={event => changeView(event.currentTarget.value as CalendarMode)}><For each={modes}>{mode => <option value={mode}>{mode === 'Timeline' ? 'Agenda' : mode}</option>}</For></select></label>
      </div>
      <Show when={scheduleView() !== 'Month'}><div class="calendar-presentation" role="group" aria-label="Calendar presentation"><button class="btn-secondary" aria-pressed={!showHours()} onClick={() => { setShowHours(false); persistView(); }}>List</button><button class="btn-secondary" aria-pressed={showHours()} onClick={() => { setShowHours(true); persistView(); }}>Time grid</button></div></Show>
      <div class="calendar-context-tools">
        <div class="calendar-timezone-control" ref={timezoneControl}>
          <button ref={timezoneTrigger} type="button" class="calendar-timezone-trigger" aria-label={`Change timezone: ${zone()}`} aria-expanded={timezoneOpen()} onClick={() => { if (timezoneOpen()) closeTimezone(); else { setTimezoneDraft(zone()); setTimezoneOpen(true); } }}><Globe size={13} aria-hidden="true" /><span>{zone()}</span></button>
          <Show when={timezoneOpen()}><form class="calendar-timezone-popover" aria-label="Change calendar timezone" onSubmit={async event => { event.preventDefault(); if (timezoneSaving()) return; setTimezoneSaving(true); const saved = await selectZone(timezoneDraft()); setTimezoneSaving(false); if (saved) closeTimezone(); }}>
            <label for="calendar-timezone-edit">Timezone</label><input id="calendar-timezone-edit" aria-label="Calendar timezone" ref={element => queueMicrotask(() => element.focus())} value={timezoneDraft()} list="calendar-timezones" disabled={timezoneSaving()} onInput={event => setTimezoneDraft(event.currentTarget.value)} />
            <datalist id="calendar-timezones"><For each={['UTC', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'America/New_York', 'Europe/London']}>{value => <option value={value} />}</For></datalist>
            <div><button type="button" class="btn-secondary" disabled={timezoneSaving()} onClick={closeTimezone}>Cancel</button><button type="submit" class="btn-primary" disabled={timezoneSaving()}>{timezoneSaving() ? 'Saving…' : 'Save timezone'}</button></div>
          </form></Show>
        </div>
        <Show when={compact()}><button type="button" class="btn-secondary" aria-haspopup="dialog" onClick={() => setTaskPickerOpen(true)}><ListTodo size={14} />Jadwalkan task<span class="calendar-picker-count">{backlogTasks().length}</span></button></Show>
      </div>
    </div>
    <Show when={loadError()}><p role="alert" class="calendar-message">{loadError()} <button class="btn-secondary" onClick={() => void loadData()}>Coba lagi</button></p></Show>
    <Show when={sessionError()}><p class="calendar-message" role="alert">{sessionError()} <button class="btn-secondary" onClick={() => { setSessionError(''); void loadData(true); }}>Coba lagi</button></p></Show>
    <Show when={undoChange()}><div class="calendar-undo" role="status">Session updated.<button class="btn-secondary" disabled={sessionBusy()} onClick={() => { const change = undoChange(); if (change) void writeSession(change.after, { start_at: change.before.start_at, end_at: change.before.end_at }, true); }}>Urungkan</button><button class="btn-ghost-icon" aria-label="Dismiss session update" onClick={() => setUndoChange(null)}><X size={14} /></button></div></Show>
    <Show when={loading()}><p role="status" class="calendar-message">Loading calendar…</p></Show>
    <div class="calendar-layout" aria-busy={loading()}>
      <Show when={!compact()}><aside class="calendar-backlog" aria-label="Tasks to schedule"><h2>Tasks to schedule <span class="calendar-picker-count">{backlogTasks().length}</span></h2><p>No upcoming session. Drag a task into the time grid, or select it to schedule.</p>{taskChoices()}</aside></Show>
      <section class="calendar-matrix" aria-label={`${scheduleView()} calendar`}>
        <Show when={scheduleView() === 'Month'}>
          <div class="calendar-month-head"><For each={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}>{day => <span>{day}</span>}</For></div>
          <div class="calendar-month"><For each={days()}>{day => <div class="calendar-month-day" onClick={event => { if (event.target === event.currentTarget) { setAnchor(day); openEvent(); } }} data-date={dateKey(day)} classList={{ 'calendar-outside': day.getMonth() !== anchor().getMonth(), 'calendar-today': dateKey(day) === dateKey(zonedDate(new Date())) }}>
            <button class="calendar-date" aria-label={`View ${formatDay(day)}`} onClick={event => { event.stopPropagation(); setAnchor(day); changeView('Day'); }}>{day.getDate()}</button>
            <For each={dayItems(day).slice(0, 3)}>{itemCard}</For><Show when={dayItems(day).length > 3}><button class="calendar-more" onClick={event => { event.stopPropagation(); setAnchor(day); changeView('Day'); }}>+{dayItems(day).length - 3} more</button></Show>
          </div>}</For></div>
        </Show>
        <Show when={scheduleView() === 'Timeline' || ((scheduleView() === 'Week' || scheduleView() === 'Day') && !showHours())}>
          <div class="calendar-agenda" classList={{ 'calendar-week-agenda': scheduleView() === 'Week' }}><For each={days()}>{day => <section data-date={dateKey(day)}><Show when={scheduleView() !== 'Day'}><h3 classList={{ 'calendar-today-label': dateKey(day) === dateKey(zonedDate(new Date())) }}>{formatDay(day)}</h3></Show>
            <p class="calendar-capacity">{busyLabel(day)}<Show when={hasOverlaps(day)}> · Overlapping sessions</Show></p><For each={itemsOnDay(items(), day)} fallback={<p>No scheduled items.</p>}>{itemCard}</For>
          </section>}</For></div>
        </Show>
        <Show when={(scheduleView() === 'Week' || scheduleView() === 'Day') && showHours()}>
          <div class="calendar-time-scroll" tabindex="0" role="region" aria-label="Hourly calendar">
          <div class="calendar-time-head" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}><span>Time</span>
            <For each={days()}>{day => <div classList={{ 'calendar-today': dateKey(day) === dateKey(zonedDate(new Date())) }}>{formatDay(day)}<small class="calendar-capacity">{busyLabel(day)}<Show when={hasOverlaps(day)}> · Overlap</Show></small>
              <For each={itemsOnDay(items(), day).filter(item => item.allDay).slice(0, 3)}>{itemCard}</For><Show when={itemsOnDay(items(), day).filter(item => item.allDay).length > 3}><button class="calendar-more" onClick={event => { event.stopPropagation(); setAnchor(day); changeView('Day'); setShowHours(false); persistView(); }}>+{itemsOnDay(items(), day).filter(item => item.allDay).length - 3} day items</button></Show>
            </div>}</For>
          </div>
          <div class="calendar-time-grid" style={{ 'grid-template-columns': `56px repeat(${days().length}, minmax(100px, 1fr))` }}>
            <div class="calendar-hours"><For each={Array.from({ length: 24 }, (_, index) => index)}>{hour => <span>{String(hour).padStart(2, '0')}:00</span>}</For></div>
            <For each={days()}>{day => <div class="calendar-time-day" data-date={dateKey(day)} onDragOver={event => dragOver(event, day)} onDragLeave={event => { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) setDropPreview(null); }} onDrop={event => dropSession(event, day)} onClick={event => { if (event.target === event.currentTarget && !sessionBusy() && !suppressClick) openSlot(day, slotMinute(event.currentTarget as HTMLElement, event.clientY)); }}>

              <Show when={dateKey(day) === dateKey(zonedDate(clockNow()))}><div class="calendar-now-line" aria-label="Current time" style={{ top: `${(zonedDate(clockNow()).getHours() + zonedDate(clockNow()).getMinutes() / 60) * 48}px` }} /></Show>
              <Show when={dropPreview()?.day === dateKey(day)}><div class="calendar-slot-preview" style={{ top: `${dropPreview()!.minute / 60 * 48}px` }}>{String(Math.floor(dropPreview()!.minute / 60)).padStart(2, '0')}:{String(dropPreview()!.minute % 60).padStart(2, '0')}</div></Show>
              <For each={timedLayout(items(), day)}>{row => <div class="calendar-timed-item" style={{ top: `${row.top}px`, height: `${resizePreview()?.id === row.item.sourceId ? Math.max(22, (Math.min(zonedDate(resizePreview()!.end).getTime(), addDays(day, 1).getTime()) - row.start) / 3600000 * 48) : row.height}px`, left: `${row.lane / row.lanes * 100}%`, width: `${100 / row.lanes}%` }}>{itemCard(row.item)}
                <Show when={resizePreview()?.id === row.item.sourceId}><span class="calendar-resize-preview">Until {formatTime(zonedDate(resizePreview()!.end))}</span></Show>
                <button class="calendar-session-resize" aria-label={`Resize session: ${row.item.title}`} title="Drag to change duration; use Edit event for keyboard controls" disabled={sessionBusy()} onClick={event => { event.stopPropagation(); const current = eventFor(row.item); if (current && event.detail === 0 && !suppressClick) editEvent(current); }} onPointerDown={event => startResize(event, row.item)} onPointerMove={updateResize} onPointerUp={finishResize} onPointerCancel={cancelResize} onLostPointerCapture={cancelResize}><GripHorizontal size={12} /></button>
              </div>}</For>
            </div>}</For>
          </div></div>
        </Show>
        <Show when={!loading() && !loadError() && visibleItems().length === 0}><p class="calendar-message" role="status">No events or dated tasks in this period.</p></Show>
      </section>
    </div>
      <Show when={taskPickerOpen() && compact()}><div class="calendar-picker-backdrop" onClick={event => { if (event.target === event.currentTarget) setTaskPickerOpen(false); }}><section class="calendar-task-picker" ref={element => focusScope(element, () => setTaskPickerOpen(false))}>
        <header><h2>Jadwalkan task <span class="calendar-picker-count">{backlogTasks().length}</span></h2><button type="button" class="btn-ghost-icon" aria-label="Close task picker" onClick={() => setTaskPickerOpen(false)}><X size={18} /></button></header><p>Select a task to view details and choose a time.</p>{taskChoices()}
      </section></div></Show>
      <Show when={selectedItem() && (detailEvent() || detailTask())}>
        <div class="calendar-detail-backdrop" onClick={event => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <section class="calendar-detail" ref={element => focusScope(element, () => setSelectedItem(null))}>
            <header><span>{selectedItem()?.kind}</span><button type="button" class="btn-ghost-icon" aria-label="Close item details" onClick={() => setSelectedItem(null)}><X size={18} /></button></header>
            <h2>{detailEvent()?.title || detailTask()?.title}</h2><Show when={detailTask()}>{task => <TaskContext task={task()} />}</Show>
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
            padding: "var(--space-4)"
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
            padding: "var(--space-5)"
          }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": "var(--space-4)" }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)" }}>
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
            <Show when={eventWarning() > 0}><p role="status" class="calendar-overlap-warning">This session overlaps {eventWarning()} existing session(s). You can still save it.</p></Show>
            <form onSubmit={handleCreateEvent} aria-busy={eventSaving()} style={{ display: 'flex', "flex-direction": 'column', gap: "var(--space-3)" }}>
              <div>
                <label for="event-title" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": "var(--space-1)", "font-family": 'var(--font-mono)' }}>EVENT TITLE</label>
                <input
                  id="event-title" required type="text"
                  autofocus
                  value={eventTitle()}
                  onInput={e => setEventTitle(e.currentTarget.value)}
                  placeholder="e.g. Design Strategy Sync..."
                  style={{ width: '100%', padding: "var(--space-2) var(--space-3)", "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: "var(--space-3)" }}>
                <div>
                  <label for="event-space" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": "var(--space-1)", "font-family": 'var(--font-mono)' }}>SPACE</label>
                  <select id="event-space"
                    value={eventSpaceId()}
                    onChange={e => { setEventSpaceId(e.currentTarget.value); setEventTaskId(''); }}
                    style={{ width: '100%', padding: "var(--space-2) var(--space-2)", "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="">General</option>
                    <For each={spaces()}>
                      {(sp) => <option value={sp.id}>{sp.name}</option>}
                    </For>
                  </select>
                </div>

                <div>
                  <label for="event-date" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": "var(--space-1)", "font-family": 'var(--font-mono)' }}>DATE</label>
                  <input id="event-date" type="date" required value={eventDate()} onInput={e => { setEventDate(e.currentTarget.value); if (eventEndDate() < e.currentTarget.value) setEventEndDate(e.currentTarget.value); }} />
                </div>
              </div>

              <label for="event-end-date">End date<input id="event-end-date" type="date" required value={eventEndDate()} onInput={event => setEventEndDate(event.currentTarget.value)} /></label>
              <div><label for="event-task">Linked task</label><select id="event-task" style={{ width: '100%' }} value={eventTaskId()} onChange={event => { setEventTaskId(event.currentTarget.value); const task = tasks().find(task => task.id === event.currentTarget.value); if (task) setEventSpaceId(task.space_id); }}><option value="">No linked task</option><For each={tasks()}>{task => <option value={task.id}>{task.title}</option>}</For></select></div>
              <label for="event-all-day"><input id="event-all-day" type="checkbox" aria-label="All day" checked={eventAllDay()} onChange={event => setEventAllDay(event.currentTarget.checked)} /> All day</label>
              <Show when={!eventAllDay()}>
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: "var(--space-3)" }}>
                <div>
                  <label for="event-start" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": "var(--space-1)", "font-family": 'var(--font-mono)' }}>START TIME</label>
                  <input
                    id="event-start" required type="time"
                    value={eventStartHour()}
                    onInput={e => setEventStartHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: "var(--space-2) var(--space-2)", "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
                <div>
                  <label for="event-end" style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": "var(--space-1)", "font-family": 'var(--font-mono)' }}>END TIME</label>
                  <input
                    id="event-end" required type="time"
                    value={eventEndHour()}
                    onInput={e => setEventEndHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: "var(--space-2) var(--space-2)", "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
              </div>
              </Show>
              <small>Times use {zone()}. All-day end dates include the selected day.</small>

              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: "var(--space-2)", "margin-top": "var(--space-2)" }}>
                <Show when={editingEvent()}><button type="button" class="btn-ghost-danger" disabled={eventSaving()} onClick={() => void removeEvent()}>Delete event</button></Show>
                <button
                  type="button"
                  disabled={eventSaving()}
                  class="btn-secondary"
                  onClick={() => setIsEventModalOpen(false)}
                  style={{ padding: "var(--space-2) var(--space-4)", "font-size": '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={eventSaving()}
                  class="btn-primary"
                  style={{ padding: "var(--space-2) var(--space-4)", "font-size": '12px', display: 'flex', "align-items": 'center', gap: "var(--space-1)" }}
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
