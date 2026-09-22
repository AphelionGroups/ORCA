import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical, 
  Box,
  RotateCcw,
  Clock,
  X
} from 'lucide-solid';
import { api } from '../services/api';
import type { CalendarEvent, Task, Space } from '../services/api';

interface CalendarViewProps {
  onOpenQuickCapture: () => void;
  onNavigate?: (route: string, spaceId?: string | null) => void;
}

export const CalendarView: Component<CalendarViewProps> = (props) => {
  const [spaceFilter, setSpaceFilter] = createSignal('all');
  const [scheduleView, setScheduleView] = createSignal('Week');
  const [events, setEvents] = createSignal<CalendarEvent[]>([]);
  const [backlogTasks, setBacklogTasks] = createSignal<Task[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [loading, setLoading] = createSignal(true);

  // New Event Modal state
  const [isEventModalOpen, setIsEventModalOpen] = createSignal(false);
  const [eventTitle, setEventTitle] = createSignal('');
  const [eventSpaceId, setEventSpaceId] = createSignal('');
  const [eventDayOffset, setEventDayOffset] = createSignal(0); // 0 = Wed/Today, -2=Mon, -1=Tue, 1=Thu, 2=Fri
  const [eventStartHour, setEventStartHour] = createSignal('10:00');
  const [eventEndHour, setEventEndHour] = createSignal('11:30');

  const loadData = async () => {
    setLoading(true);
    try {
      const selectedSpace = spaceFilter() === 'all' 
        ? undefined 
        : spaces().find(s => s.slug === spaceFilter() || s.id === spaceFilter())?.id;

      const [fetchedEvents, fetchedTasks, fetchedSpaces] = await Promise.all([
        api.getEvents(selectedSpace ? { space_id: selectedSpace } : {}),
        api.getTasks({ inbox: true }),
        api.getSpaces()
      ]);

      setEvents(fetchedEvents || []);
      setBacklogTasks(fetchedTasks || []);
      setSpaces(fetchedSpaces || []);

      if (!eventSpaceId() && fetchedSpaces && fetchedSpaces.length > 0) {
        setEventSpaceId(fetchedSpaces[0].id);
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  createEffect(() => {
    // Re-fetch when spaceFilter changes
    spaceFilter();
    loadData();
  });

  const getSpaceInfo = (spaceId?: string) => {
    if (!spaceId) return { name: 'General', color: 'var(--secondary)' };
    const sp = spaces().find(s => s.id === spaceId);
    return {
      name: sp ? sp.name : 'Space',
      color: sp ? sp.color : 'var(--secondary)'
    };
  };

  const handleCreateEvent = async (e: Event) => {
    e.preventDefault();
    if (!eventTitle().trim()) return;

    try {
      const now = new Date();
      // Calculate target date based on day offset from today (Wed)
      const targetDate = new Date(now.getTime() + eventDayOffset() * 24 * 60 * 60 * 1000);
      const [startH, startM] = eventStartHour().split(':').map(Number);
      const [endH, endM] = eventEndHour().split(':').map(Number);

      const startDate = new Date(targetDate);
      startDate.setHours(startH || 10, startM || 0, 0, 0);

      const endDate = new Date(targetDate);
      endDate.setHours(endH || 11, endM || 30, 0, 0);

      const newEv = await api.createEvent({
        title: eventTitle().trim(),
        space_id: eventSpaceId() || spaces()[0]?.id,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        is_all_day: false
      });

      setEvents([...events(), newEv]);
      setEventTitle('');
      setIsEventModalOpen(false);
    } catch (err) {
      console.error('Failed to create calendar event:', err);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', "overflow-y": 'auto' }}>
      {/* Calendar Top Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <div class="breadcrumb-title">
            <Calendar size={17} color="var(--primary)" />
            <span>Calendar</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="badge-outline">
            Temporal Matrix View
          </span>
        </div>

        <div class="header-actions">
          <button 
            onClick={loadData}
            title="Refresh events"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              "align-items": 'center',
              padding: '6px'
            }}
          >
            <RotateCcw size={14} />
          </button>

          <div style={{ display: 'flex', "align-items": 'center', gap: '8px', padding: '4px 12px', "border-radius": '9999px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', "font-size": '12px' }}>
            <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
              <span style={{ position: 'absolute', width: '100%', height: '100%', "border-radius": '50%', "background-color": 'var(--secondary)', opacity: 0.75, animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
              <span style={{ position: 'relative', width: '8px', height: '8px', "border-radius": '50%', "background-color": 'var(--secondary)' }}></span>
            </span>
            <span style={{ color: 'var(--text-muted)', "font-size": '11px' }}>
              {loading() ? 'Syncing...' : 'Live Sync Active'}
            </span>
          </div>

          <button 
            onClick={props.onOpenQuickCapture}
            class="btn-pill-ghost"
            title="Quick capture item"
          >
            <Plus size={14} color="var(--tertiary)" />
            <span>Capture</span>
          </button>

          <button 
            onClick={() => setIsEventModalOpen(true)}
            class="btn-pill-white"
          >
            <Plus size={14} />
            <span>Add Event</span>
          </button>
        </div>
      </header>

      {/* Ribbon Controls */}
      <div style={{ padding: '24px 32px 16px 32px', display: 'flex', "flex-wrap": 'wrap', "align-items": 'center', "justify-content": 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '24px' }}>
          <div style={{ display: 'flex', "align-items": 'baseline', gap: '8px' }}>
            <span style={{ "font-size": '22px', color: '#fff', "font-weight": 600, "letter-spacing": '-0.02em' }}>Current Sprint</span>
            <span style={{ "font-size": '16px', color: 'var(--text-muted)', "font-weight": 300 }}>2026</span>
          </div>
          <div style={{ display: 'flex', "align-items": 'center', padding: '2px', "border-radius": '4px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)' }}>
            <button style={{ width: '28px', height: '28px', display: 'flex', "align-items": 'center', "justify-content": 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <button style={{ padding: '2px 10px', "font-size": '12px', color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>Today</button>
            <button style={{ width: '28px', height: '28px', display: 'flex', "align-items": 'center', "justify-content": 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Space Filters */}
          <div style={{ display: 'flex', "align-items": 'center', gap: '4px', padding: '3px', "border-radius": '9999px', "background-color": 'var(--surface-container-lowest)', border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => setSpaceFilter('all')}
              style={{
                padding: '4px 12px',
                "border-radius": '9999px',
                "font-size": '12px',
                border: 'none',
                "background-color": spaceFilter() === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: spaceFilter() === 'all' ? '#fff' : 'var(--text-muted)',
                "font-weight": spaceFilter() === 'all' ? 500 : 400,
                cursor: 'pointer'
              }}
            >
              All Spaces
            </button>
            <For each={spaces()}>
              {(sp) => (
                <button
                  onClick={() => setSpaceFilter(sp.id)}
                  style={{
                    padding: '4px 12px',
                    "border-radius": '9999px',
                    "font-size": '12px',
                    border: 'none',
                    "background-color": spaceFilter() === sp.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: spaceFilter() === sp.id ? '#fff' : 'var(--text-muted)',
                    "font-weight": spaceFilter() === sp.id ? 500 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {sp.name}
                </button>
              )}
            </For>
          </div>
        </div>

        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', padding: '2px', "border-radius": '4px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)' }}>
            <For each={['Month', 'Week', 'Day', 'Timeline']}>
              {(mode) => (
                <button
                  onClick={() => setScheduleView(mode)}
                  style={{
                    padding: '4px 12px',
                    "font-size": '12px',
                    "border-radius": '4px',
                    border: 'none',
                    "background-color": scheduleView() === mode ? 'var(--surface-container-high)' : 'transparent',
                    color: scheduleView() === mode ? '#fff' : 'var(--text-muted)',
                    "font-weight": scheduleView() === mode ? 500 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {mode}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Matrix & Backlog */}
      <div style={{ padding: '0 32px 48px 32px', display: 'flex', gap: '24px', "align-items": 'flex-start' }}>
        {/* Left Unscheduled Backlog */}
        <div style={{ width: '280px', "flex-shrink": 0, display: 'flex', "flex-direction": 'column', gap: '12px' }}>
          <div style={{ padding: '16px', "border-radius": '8px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', gap: '4px' }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', "letter-spacing": '0.1em', color: 'var(--text-dim)' }}>Unscheduled Nodes</span>
              <span style={{ padding: '2px 6px', "border-radius": '4px', "background-color": 'rgba(255,255,255,0.1)', "font-size": '10px', color: '#fff' }}>
                {backlogTasks().length}
              </span>
            </div>
            <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', "line-height": 1.4 }}>
              Active inbox tasks awaiting execution time slot allocation.
            </p>
          </div>

          <Show when={backlogTasks().length > 0} fallback={
            <div style={{ padding: '24px', "text-align": 'center', color: 'var(--text-dim)', "font-size": '11px' }}>
              No unscheduled inbox tasks.
            </div>
          }>
            <For each={backlogTasks()}>
              {(task) => {
                const sp = getSpaceInfo(task.space_id);
                return (
                  <div 
                    style={{
                      padding: '14px',
                      "border-radius": '8px',
                      "background-color": 'var(--surface-container-low)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'grab'
                    }}
                  >
                    <div style={{ display: 'flex', "align-items": 'flex-start', "justify-content": 'space-between', "margin-bottom": '6px' }}>
                      <span style={{
                        padding: '2px 6px',
                        "border-radius": '4px',
                        "font-size": '10px',
                        "font-family": 'var(--font-mono)',
                        "text-transform": 'uppercase',
                        "background-color": 'rgba(68,225,222,0.1)',
                        color: sp.color
                      }}>
                        {sp.name}
                      </span>
                      <GripVertical size={14} color="var(--text-dim)" />
                    </div>
                    <h4 style={{ "font-size": '12px', "font-weight": 600, color: '#fff', margin: 0, "line-height": 1.4 }}>
                      {task.title}
                    </h4>
                    <div style={{ "margin-top": '8px', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
                        <Box size={12} color="var(--secondary)" />
                        <span>Task node</span>
                      </div>
                      <span style={{ "font-family": 'var(--font-mono)' }}>~45m est.</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>

        {/* Main Weekly Architectural Grid */}
        <div style={{ flex: 1, "min-width": 0, "border-radius": '8px', "background-color": 'var(--surface-container-lowest)', border: '1px solid var(--border-default)', overflow: 'hidden', display: 'flex', "flex-direction": 'column' }}>
          {/* Day Columns Header */}
          <div style={{ display: 'grid', "grid-template-columns": '60px repeat(5, 1fr)', "background-color": 'var(--surface-container-low)', "border-bottom": '1px solid var(--border-default)', "text-align": 'center' }}>
            <div style={{ padding: '12px 0', "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>GMT+7</div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Mon</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Tue</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)', "background-color": 'rgba(26,28,34,0.6)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', "background-color": 'var(--secondary)' }}></div>
              <span style={{ "font-size": '12px', color: 'var(--secondary)', "font-weight": 600 }}>Wed (Today)</span>
            </div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Thu</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Fri</span></div>
          </div>

          {/* Time Slots Area */}
          <div style={{ position: 'relative', display: 'grid', "grid-template-columns": '60px repeat(5, 1fr)', height: '620px', "overflow-y": 'auto' }}>
            {/* Time labels column */}
            <div style={{ display: 'flex', "flex-direction": 'column', "text-align": 'right', "font-family": 'var(--font-mono)', "font-size": '10px', color: 'rgba(100,116,139,0.6)', "padding-right": '8px', "padding-top": '8px', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ height: '64px' }}>08:00</div>
              <div style={{ height: '64px' }}>10:00</div>
              <div style={{ height: '64px' }}>12:00</div>
              <div style={{ height: '64px' }}>14:00</div>
              <div style={{ height: '64px' }}>16:00</div>
              <div style={{ height: '64px' }}>18:00</div>
            </div>

            {/* Col Mon */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '16px', left: '6px', right: '6px', height: '96px', "border-radius": '6px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0, overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>Brand Visual Alignment</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>08:30 - 10:15</span>
              </div>
            </div>

            {/* Col Tue */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '112px', left: '6px', right: '6px', height: '112px', "border-radius": '6px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', color: 'var(--primary)', "text-transform": 'uppercase' }}>Kantor</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Sprint Architecture Sync</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>10:00 - 12:30</span>
              </div>
            </div>

            {/* Col Wed (Today Active with Live events from PostgreSQL) */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)', "background-color": 'rgba(68,225,222,0.02)' }}>
              {/* Current line pulse */}
              <div style={{ position: 'absolute', top: '160px', left: 0, right: 0, "z-index": 30, display: 'flex', "align-items": 'center', "pointer-events": 'none' }}>
                <div style={{ width: '8px', height: '8px', "border-radius": '50%', "background-color": 'var(--secondary)', "margin-left": '-4px' }}></div>
                <div style={{ height: '1px', flex: 1, "background-color": 'var(--secondary)', "box-shadow": '0 0 8px rgba(68,225,222,0.8)' }}></div>
                <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', "background-color": 'var(--secondary)', color: '#000', padding: '0 4px', "border-radius": '2px', "margin-right": '4px' }}>Now</span>
              </div>

              {/* Dynamic Events from PostgreSQL */}
              <For each={events()}>
                {(ev, index) => {
                  const sp = getSpaceInfo(ev.space_id);
                  const topOffset = 30 + index() * 140;

                  return (
                    <div style={{
                      position: 'absolute',
                      top: `${topOffset}px`,
                      left: '6px',
                      right: '6px',
                      height: '112px',
                      "border-radius": '6px',
                      padding: '10px',
                      "background-color": index() === 0 ? 'var(--surface-container-high)' : 'rgba(34,37,44,0.9)',
                      border: index() === 0 ? '1px solid rgba(68,225,222,0.4)' : '1px solid var(--border-default)',
                      display: 'flex',
                      "flex-direction": 'column',
                      "justify-content": 'space-between'
                    }}>
                      <div>
                        <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', color: sp.color, "text-transform": 'uppercase' }}>
                          {sp.name} {index() === 0 ? '• Live' : ''}
                        </span>
                        <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>
                          {ev.title}
                        </h5>
                      </div>
                      <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: index() === 0 ? 'var(--secondary)' : 'var(--text-dim)' }}>
                        {new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Col Thu */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '80px', left: '6px', right: '6px', height: '96px', "border-radius": '6px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', color: 'var(--primary)', "text-transform": 'uppercase' }}>Kantor</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Quarterly Budget Modeling</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>09:30 - 11:30</span>
              </div>
            </div>

            {/* Col Fri */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '144px', left: '6px', right: '6px', height: '96px', "border-radius": '6px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Launch Campaign Review</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>11:00 - 12:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      <Show when={isEventModalOpen()}>
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            "z-index": 60,
            display: 'flex',
            "align-items": 'center',
            "justify-content": 'center',
            "background-color": 'rgba(0, 0, 0, 0.6)',
            "backdrop-filter": 'blur(4px)',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsEventModalOpen(false); }}
        >
          <div style={{
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
                onClick={() => setIsEventModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', "flex-direction": 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>EVENT TITLE</label>
                <input 
                  type="text"
                  autofocus
                  value={eventTitle()}
                  onInput={e => setEventTitle(e.currentTarget.value)}
                  placeholder="e.g. Design Strategy Sync..."
                  style={{ width: '100%', padding: '6px 10px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>SPACE</label>
                  <select
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
                  <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>DAY</label>
                  <select
                    value={eventDayOffset()}
                    onChange={e => setEventDayOffset(Number(e.currentTarget.value))}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value={-2}>Monday</option>
                    <option value={-1}>Tuesday</option>
                    <option value={0}>Wednesday (Today)</option>
                    <option value={1}>Thursday</option>
                    <option value={2}>Friday</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>START TIME</label>
                  <input 
                    type="time" 
                    value={eventStartHour()}
                    onInput={e => setEventStartHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)' }}>END TIME</label>
                  <input 
                    type="time" 
                    value={eventEndHour()}
                    onInput={e => setEventEndHour(e.currentTarget.value)}
                    style={{ width: '100%', padding: '6px 8px', "font-size": '12px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', "border-radius": '4px', color: 'var(--text-main)', outline: 'none', "box-sizing": 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px', "margin-top": '8px' }}>
                <button 
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  style={{ padding: '6px 12px', "font-size": '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '6px 16px', "font-size": '12px', "background-color": '#fff', color: '#000', "font-weight": 500, "border-radius": '4px', border: 'none', cursor: 'pointer', display: 'flex', "align-items": 'center', gap: '4px' }}
                >
                  <Clock size={13} />
                  <span>Book Event</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};
