import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';

interface CanvasHubScreenProps {
  onNavigate: (route: string, spaceId?: string) => void;
  onOpenQuickCapture: () => void;
}

export const CanvasHubScreen: Component<CanvasHubScreenProps> = (props) => {
  const [filter, setFilter] = createSignal('All');
  const [searchQuery, setSearchQuery] = createSignal('');

  const canvases = [
    {
      id: '01',
      title: '01 Brand Strategy & Ideation',
      nodes: 14,
      docs: 3,
      time: 'Edited 12m ago',
      tag: 'Strategy',
      active: true
    },
    {
      id: '02',
      title: '02 UI System & Spatial Nodes',
      nodes: 28,
      docs: 8,
      time: 'Edited yesterday',
      tag: 'Design System'
    },
    {
      id: '03',
      title: '03 Packaging Architecture',
      nodes: 6,
      docs: 'Specs ready',
      time: 'Edited 3 days ago',
      tag: 'Design System'
    },
    {
      id: '04',
      title: '04 User Journey Flow',
      nodes: 19,
      docs: '5 Branch Paths',
      time: 'Edited last week',
      tag: 'Flows'
    }
  ];

  const filtered = () => canvases.filter(c => {
    const matchesFilter = filter() === 'All' || c.tag === filter();
    const matchesSearch = c.title.toLowerCase().includes(searchQuery().toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ height: '100vh', display: 'flex', "flex-direction": 'column', "background-color": '#111317', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-top-header">
        <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "font-size": '12px' }}>
          <span style={{ "font-weight": 500, color: 'var(--text-muted)' }}>Bisnis A</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ color: '#fff', "font-weight": 500, display: 'flex', "align-items": 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', "border-radius": '2px', "background-color": 'var(--secondary)' }}></span>
            Rebranding & Launch
          </span>
        </div>

        {/* Segmented View Tabs */}
        <div class="segmented-control">
          <button 
            class="seg-item active"
            onClick={() => props.onNavigate('canvas-hub')}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--secondary)' }}>dashboard</span>
            <span>Canvas</span>
            <span style={{ "padding": '1px 6px', "border-radius": '12px', "font-size": '10px', "background-color": 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', "font-family": 'monospace' }}>4</span>
          </button>
          <button 
            class="seg-item"
            onClick={() => props.onNavigate('documents')}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>description</span>
            <span>Documents</span>
          </button>
          <button 
            class="seg-item"
            onClick={() => props.onNavigate('tasks')}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>check_circle</span>
            <span>Tasks</span>
          </button>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', "align-items": 'center' }}>
            <span class="material-symbols-outlined" style={{ position: 'absolute', left: '10px', "font-size": '15px', color: 'var(--text-dim)' }}>search</span>
            <input 
              value={searchQuery()}
              onInput={e => setSearchQuery(e.currentTarget.value)}
              placeholder="Filter canvases..." 
              type="text"
              style={{
                "background-color": 'var(--surface-container-low)',
                border: '1px solid var(--border-default)',
                "border-radius": '2px',
                padding: '4px 10px 4px 32px',
                "font-size": '12px',
                color: '#fff',
                width: '176px',
                outline: 'none'
              }}
            />
          </div>
          <button 
            onClick={() => props.onNavigate('canvas')}
            style={{
              display: 'flex',
              "align-items": 'center',
              gap: '6px',
              padding: '6px 12px',
              "font-size": '12px',
              "font-weight": 500,
              color: '#000',
              "background-color": '#fff',
              border: 'none',
              "border-radius": '2px',
              cursor: 'pointer'
            }}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
            <span>New Canvas</span>
          </button>
        </div>
      </header>

      {/* Main Hub Grid */}
      <main style={{ position: 'relative', flex: 1, "overflow-y": 'auto', padding: '32px', "background-color": '#111317' }}>
        <div style={{ "max-width": '1360px', margin: '0 auto' }}>
          {/* Subheader bar */}
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '24px', "padding-bottom": '16px', "border-bottom": '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
              <h1 style={{ "font-size": '14px', "font-weight": 600, color: '#fff', "letter-spacing": '0.05em', "font-family": 'monospace', "text-transform": 'uppercase', margin: 0 }}>
                Project Canvases
              </h1>
              <span style={{ padding: '2px 8px', "border-radius": '4px', "font-size": '11px', "font-family": 'monospace', "background-color": 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                {filtered().length} Canvases
              </span>
              <div style={{ width: '1px', height: '14px', "background-color": 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>
              <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                <For each={['All', 'Strategy', 'Design System', 'Flows']}>
                  {(cat) => (
                    <button
                      onClick={() => setFilter(cat)}
                      style={{
                        padding: '2px 10px',
                        "border-radius": '9999px',
                        "font-size": '12px',
                        border: filter() === cat ? '1px solid var(--border-default)' : 'none',
                        "background-color": filter() === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: filter() === cat ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {cat}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '12px', color: 'var(--text-dim)', "font-family": 'monospace' }}>
              <span style={{ width: '6px', height: '6px', "border-radius": '50%', "background-color": '#34d399', display: 'inline-block' }}></span>
              <span>All boards synchronized</span>
            </div>
          </div>

          {/* Grid cards */}
          <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Blank slate template card */}
            <div 
              onClick={() => props.onNavigate('canvas')}
              style={{
                display: 'flex',
                "flex-direction": 'column',
                height: '270px',
                "border-radius": '8px',
                border: '1px dashed rgba(255,255,255,0.15)',
                "background-color": 'rgba(22, 24, 29, 0.5)',
                padding: '20px',
                cursor: 'pointer',
                "justify-content": 'space-between',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', "align-items": 'flex-start', "justify-content": 'space-between' }}>
                <div style={{ width: '36px', height: '36px', "border-radius": '6px', "background-color": 'rgba(255,255,255,0.06)', border: '1px solid var(--border-default)', display: 'flex', "align-items": 'center', "justify-content": 'center', color: '#fff' }}>
                  <span class="material-symbols-outlined" style={{ "font-size": '20px' }}>add</span>
                </div>
                <span style={{ "font-size": '10px', "font-family": 'monospace', "text-transform": 'uppercase', "letter-spacing": '0.1em', color: 'var(--text-dim)', padding: '2px 8px', "border-radius": '4px', border: '1px solid rgba(255,255,255,0.05)', "background-color": 'rgba(255,255,255,0.02)' }}>
                  Blank Slate
                </span>
              </div>
              <div>
                <h3 style={{ "font-size": '14px', "font-weight": 500, color: '#fff', margin: '0 0 4px 0' }}>New Infinite Canvas</h3>
                <p style={{ "font-size": '12px', color: 'var(--text-dim)', "line-height": 1.5, margin: 0 }}>Create architecture wireframes, connected mindmaps, or visual boards.</p>
              </div>
              <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "padding-top": '12px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '11px', color: 'var(--text-dim)', "font-family": 'monospace' }}>
                <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>keyboard_command_key</span>
                <span>Press N on Canvas</span>
              </div>
            </div>

            {/* Filtered Canvas Cards */}
            <For each={filtered()}>
              {(c) => (
                <div
                  onClick={() => props.onNavigate('canvas')}
                  style={{
                    display: 'flex',
                    "flex-direction": 'column',
                    height: '270px',
                    "border-radius": '8px',
                    border: '1px solid var(--border-default)',
                    "background-color": 'var(--surface-container-low)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Wireframe Thumbnail Preview */}
                  <div style={{ position: 'relative', height: '155px', width: '100%', "background-color": '#111317', "border-bottom": '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', padding: '12px', display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', "pointer-events": 'none' }} xmlns="http://www.w3.org/2000/svg">
                        <path d="M 60 40 C 110 40, 130 85, 175 85" fill="none" stroke="#44e1de" stroke-dasharray="3 3" stroke-opacity="0.6" stroke-width="1.5"></path>
                      </svg>
                      <div style={{ position: 'absolute', left: '12px', top: '16px', width: '96px', "background-color": '#1e2025', border: '1px solid rgba(255,255,255,0.2)', "border-radius": '4px', padding: '6px' }}>
                        <div style={{ width: '32px', height: '4px', "border-radius": '2px', "background-color": 'rgba(255,255,255,0.4)', "margin-bottom": '4px' }}></div>
                        <div style={{ width: '64px', height: '6px', "border-radius": '2px', "background-color": 'rgba(255,255,255,0.8)' }}></div>
                      </div>
                      <div style={{ position: 'absolute', right: '16px', top: '32px', width: '112px', "background-color": '#1e2025', border: '1px solid rgba(68,225,222,0.4)', "border-radius": '4px', padding: '6px' }}>
                        <div style={{ width: '40px', height: '4px', "border-radius": '2px', "background-color": 'rgba(68,225,222,0.8)', "margin-bottom": '4px' }}></div>
                        <div style={{ width: '80px', height: '6px', "border-radius": '2px', "background-color": 'rgba(255,255,255,0.9)' }}></div>
                      </div>
                    </div>

                    {c.active && (
                      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', "align-items": 'center', gap: '6px', "background-color": 'rgba(24,26,32,0.9)', border: '1px solid var(--border-default)', padding: '2px 8px', "border-radius": '4px', "font-size": '10px', color: '#fff', "font-family": 'monospace' }}>
                        <span style={{ width: '6px', height: '6px', "border-radius": '50%', "background-color": 'var(--secondary)' }}></span>
                        <span>Active</span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '14px', flex: 1, display: 'flex', "flex-direction": 'column', "justify-content": 'space-between' }}>
                    <div>
                      <h3 style={{ "font-size": '12px', "font-weight": 600, color: '#fff', margin: '0 0 4px 0', "letter-spacing": '-0.01em' }}>
                        {c.title}
                      </h3>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '11px', color: 'var(--text-dim)' }}>
                        <span style={{ "font-family": 'monospace', color: 'var(--text-muted)' }}>{c.nodes} Nodes</span>
                        <span>·</span>
                        <span>{typeof c.docs === 'number' ? `${c.docs} Docs Linked` : c.docs}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '8px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '11px', color: 'var(--text-dim)', "font-family": 'monospace' }}>
                      <span>{c.time}</span>
                      <div style={{ display: 'flex', "margin-left": '-4px' }}>
                        <div style={{ width: '16px', height: '16px', "border-radius": '50%', "background-color": 'rgba(255,255,255,0.2)', display: 'flex', "align-items": 'center', "justify-content": 'center', "font-size": '8px', color: '#fff' }}>R</div>
                        <div style={{ width: '16px', height: '16px', "border-radius": '50%', "background-color": 'rgba(68,225,222,0.3)', color: 'var(--secondary)', display: 'flex', "align-items": 'center', "justify-content": 'center', "font-size": '8px', "font-weight": 'bold' }}>A</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </main>
    </div>
  );
};
