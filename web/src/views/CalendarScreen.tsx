import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';

interface CalendarScreenProps {
  onOpenQuickCapture: () => void;
  onNavigate?: (route: string, spaceId?: string) => void;
}

export const CalendarScreen: Component<CalendarScreenProps> = (props) => {
  const [spaceFilter, setSpaceFilter] = createSignal('all');
  const [scheduleView, setScheduleView] = createSignal('Week');

  const backlogItems = [
    { title: 'Packaging Print Review', tag: 'Bisnis A', canvas: 'Canvas #04', duration: '~45m est.', space: 'bisnis-a' },
    { title: 'Design Review with Team', tag: 'Kantor', canvas: 'Spec_v2.md', duration: '~1h 30m', space: 'kantor' },
    { title: 'Investor Pitch Prep', tag: 'Bisnis A', canvas: 'Deck Node 12', duration: '~2h 00m', space: 'bisnis-a' },
    { title: 'Studio Sound Treatment', tag: 'Pribadi', canvas: 'Acoustics Plan', duration: '~1h 15m', space: 'pribadi' }
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', "flex-direction": 'column', "background-color": '#111317', "overflow-y": 'auto' }}>
      {/* Calendar Top Header */}
      <header class="orca-top-header" style={{ position: 'sticky', top: 0, "z-index": 40 }}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <span class="material-symbols-outlined" style={{ "font-size": '20px', color: 'var(--primary)' }}>calendar_month</span>
            <span style={{ "font-size": '14px', color: '#fff', "font-weight": 500 }}>Calendar</span>
          </div>
          <div style={{ width: '1px', height: '16px', "background-color": 'rgba(255,255,255,0.1)' }}></div>
          <div style={{ display: 'flex', "align-items": 'center', gap: '4px', "font-size": '11px', "font-family": 'monospace', color: 'var(--text-dim)' }}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>schedule</span>
            <span>Temporal Matrix View</span>
          </div>
        </div>

        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px', padding: '4px 12px', "border-radius": '9999px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', "font-size": '12px' }}>
            <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
              <span style={{ position: 'absolute', width: '100%', height: '100%', "border-radius": '50%', "background-color": 'var(--secondary)', opacity: 0.75, animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
              <span style={{ position: 'relative', width: '8px', height: '8px', "border-radius": '50%', "background-color": 'var(--secondary)' }}></span>
            </span>
            <span style={{ color: 'var(--text-muted)', "font-size": '11px' }}>Realtime Sync</span>
          </div>
          <button 
            onClick={props.onOpenQuickCapture}
            style={{
              display: 'flex',
              "align-items": 'center',
              gap: '6px',
              padding: '4px 12px',
              "font-size": '12px',
              "font-weight": 500,
              color: '#fff',
              "background-color": 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-default)',
              "border-radius": '4px',
              cursor: 'pointer'
            }}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '15px', color: 'var(--secondary)' }}>add</span>
            <span>Add Event</span>
          </button>
        </div>
      </header>

      {/* Ribbon Controls */}
      <div style={{ padding: '32px 32px 16px 32px', display: 'flex', "flex-wrap": 'wrap', "align-items": 'center', "justify-content": 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '24px' }}>
          <div style={{ display: 'flex', "align-items": 'baseline', gap: '8px' }}>
            <span style={{ "font-size": '24px', color: '#fff', "font-weight": 500, "letter-spacing": '-0.02em' }}>October</span>
            <span style={{ "font-size": '18px', color: 'var(--text-muted)', "font-weight": 300 }}>2024</span>
          </div>
          <div style={{ display: 'flex', "align-items": 'center', padding: '2px', "border-radius": '4px', "background-color": 'var(--surface-container-low)' }}>
            <button style={{ width: '28px', height: '28px', display: 'flex', "align-items": 'center', "justify-content": 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span class="material-symbols-outlined" style={{ "font-size": '16px' }}>chevron_left</span>
            </button>
            <button style={{ padding: '2px 12px', "font-size": '12px', color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>Today</button>
            <button style={{ width: '28px', height: '28px', display: 'flex', "align-items": 'center', "justify-content": 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span class="material-symbols-outlined" style={{ "font-size": '16px' }}>chevron_right</span>
            </button>
          </div>

          {/* Space Filters */}
          <div style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '4px', "border-radius": '9999px', "background-color": 'var(--surface-container-lowest)', border: '1px solid var(--border-default)' }}>
            <For each={['all', 'bisnis-a', 'kantor', 'pribadi']}>
              {(sp) => (
                <button
                  onClick={() => setSpaceFilter(sp)}
                  style={{
                    padding: '4px 12px',
                    "border-radius": '9999px',
                    "font-size": '12px',
                    "text-transform": 'capitalize',
                    border: 'none',
                    "background-color": spaceFilter() === sp ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: spaceFilter() === sp ? '#fff' : 'var(--text-muted)',
                    "font-weight": spaceFilter() === sp ? 500 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {sp === 'all' ? 'All Spaces' : sp.replace('-', ' ')}
                </button>
              )}
            </For>
          </div>
        </div>

        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', padding: '2px', "border-radius": '4px', "background-color": 'var(--surface-container-low)' }}>
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
        <div style={{ width: '288px', "flex-shrink": 0, display: 'flex', "flex-direction": 'column', gap: '12px' }}>
          <div style={{ padding: '16px', "border-radius": '12px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', gap: '4px' }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <span style={{ "font-size": '11px', "font-family": 'monospace', "text-transform": 'uppercase', "letter-spacing": '0.1em', color: 'var(--text-dim)' }}>Unscheduled Nodes</span>
              <span style={{ padding: '2px 6px', "border-radius": '4px', "background-color": 'rgba(255,255,255,0.1)', "font-size": '10px', color: '#fff' }}>4</span>
            </div>
            <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Drag spatial elements onto time blocks to lock sprint momentum.</p>
          </div>

          <For each={backlogItems}>
            {(item) => (
              <div 
                style={{
                  padding: '16px',
                  "border-radius": '12px',
                  "background-color": 'var(--surface-container-low)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'grab'
                }}
              >
                <div style={{ display: 'flex', "align-items": 'flex-start', "justify-content": 'space-between', "margin-bottom": '6px' }}>
                  <span style={{ padding: '2px 8px', "border-radius": '4px', "font-size": '10px', "font-family": 'monospace', "text-transform": 'uppercase', "letter-spacing": '0.05em', "background-color": 'rgba(68,225,222,0.1)', color: 'var(--secondary)' }}>
                    {item.tag}
                  </span>
                  <span class="material-symbols-outlined" style={{ "font-size": '15px', color: 'var(--text-dim)' }}>drag_indicator</span>
                </div>
                <h4 style={{ "font-size": '12px', "font-weight": 600, color: '#fff', margin: 0, "line-height": 1.4 }}>{item.title}</h4>
                <div style={{ "margin-top": '8px', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
                    <span class="material-symbols-outlined" style={{ "font-size": '13px', color: 'var(--secondary)' }}>view_in_ar</span>
                    <span>{item.canvas}</span>
                  </div>
                  <span style={{ "font-family": 'monospace' }}>{item.duration}</span>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Main Weekly Architectural Grid */}
        <div style={{ flex: 1, "min-width": 0, "border-radius": '12px', "background-color": 'var(--surface-container-lowest)', border: '1px solid var(--border-default)', overflow: 'hidden', display: 'flex', "flex-direction": 'column' }}>
          {/* Day Columns Header */}
          <div style={{ display: 'grid', "grid-template-columns": '60px repeat(5, 1fr)', "background-color": 'var(--surface-container-low)', "border-bottom": '1px solid var(--border-default)', "text-align": 'center' }}>
            <div style={{ padding: '12px 0', "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>GMT+7</div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Mon 21</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Tue 22</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)', "background-color": 'rgba(26,28,34,0.6)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', "background-color": 'var(--secondary)' }}></div>
              <span style={{ "font-size": '12px', color: 'var(--secondary)', "font-weight": 600 }}>Wed 23 (Today)</span>
            </div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Thu 24</span></div>
            <div style={{ padding: '12px 0', "border-left": '1px solid rgba(255,255,255,0.05)' }}><span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>Fri 25</span></div>
          </div>

          {/* Time Slots Area */}
          <div style={{ position: 'relative', display: 'grid', "grid-template-columns": '60px repeat(5, 1fr)', height: '640px', "overflow-y": 'auto' }}>
            {/* Time labels column */}
            <div style={{ display: 'flex', "flex-direction": 'column', "text-align": 'right', "font-family": 'monospace', "font-size": '10px', color: 'rgba(100,116,139,0.6)', "padding-right": '8px', "padding-top": '8px', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ height: '64px' }}>08:00</div>
              <div style={{ height: '64px' }}>10:00</div>
              <div style={{ height: '64px' }}>12:00</div>
              <div style={{ height: '64px' }}>14:00</div>
              <div style={{ height: '64px' }}>16:00</div>
              <div style={{ height: '64px' }}>18:00</div>
            </div>

            {/* Col Mon */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '16px', left: '6px', right: '6px', height: '96px', "border-radius": '8px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0, overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>Brand Visual Alignment</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>08:30 - 10:15</span>
              </div>
            </div>

            {/* Col Tue */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '112px', left: '6px', right: '6px', height: '112px', "border-radius": '8px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--primary)', "text-transform": 'uppercase' }}>Kantor</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Sprint Architecture Sync</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>10:00 - 12:30</span>
              </div>
            </div>

            {/* Col Wed (Today Active with Live indicator) */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)', "background-color": 'rgba(68,225,222,0.02)' }}>
              {/* Current line pulse */}
              <div style={{ position: 'absolute', top: '160px', left: 0, right: 0, "z-index": 30, display: 'flex', "align-items": 'center', "pointer-events": 'none' }}>
                <div style={{ width: '8px', height: '8px', "border-radius": '50%', "background-color": 'var(--secondary)', "margin-left": '-4px' }}></div>
                <div style={{ height: '1px', flex: 1, "background-color": 'var(--secondary)', "box-shadow": '0 0 8px rgba(68,225,222,0.8)' }}></div>
                <span style={{ "font-size": '9px', "font-family": 'monospace', "background-color": 'var(--secondary)', color: '#000', padding: '0 4px', "border-radius": '2px', "margin-right": '4px' }}>11:15</span>
              </div>

              <div style={{ position: 'absolute', top: '40px', left: '6px', right: '6px', height: '112px', "border-radius": '8px', padding: '10px', "background-color": 'var(--surface-container-high)', border: '1px solid rgba(68,225,222,0.4)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A • Live</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Rebranding Presentation Deck</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--secondary)' }}>09:00 - 11:00</span>
              </div>

              <div style={{ position: 'absolute', top: '208px', left: '6px', right: '6px', height: '128px', "border-radius": '8px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Packaging CAD & Material Signoff</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>14:00 - 16:30</span>
              </div>
            </div>

            {/* Col Thu */}
            <div style={{ position: 'relative', "border-right": '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ position: 'absolute', top: '80px', left: '6px', right: '6px', height: '96px', "border-radius": '8px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--primary)', "text-transform": 'uppercase' }}>Kantor</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Quarterly Budget Modeling</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>09:30 - 11:30</span>
              </div>
            </div>

            {/* Col Fri */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '144px', left: '6px', right: '6px', height: '96px', "border-radius": '8px', padding: '10px', "background-color": 'rgba(34,37,44,0.9)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                <div>
                  <span style={{ "font-size": '9px', "font-family": 'monospace', color: 'var(--secondary)', "text-transform": 'uppercase' }}>Bisnis A</span>
                  <h5 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>Launch Campaign Review</h5>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', color: 'var(--text-dim)' }}>11:00 - 12:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
