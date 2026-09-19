import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';

interface SpacesMasterScreenProps {
  onNavigate: (route: string, spaceId?: string) => void;
  onOpenQuickCapture: () => void;
}

export const SpacesMasterScreen: Component<SpacesMasterScreenProps> = (props) => {
  const [search, setSearch] = createSignal('');
  const [viewMode, setViewMode] = createSignal<'grid' | 'dense'>('grid');

  const spacesData = [
    {
      id: 'kantor',
      title: 'Kantor',
      category: 'Corporate',
      desc: 'Central operational command. Houses multi-jurisdiction legal filings, capital allocation projections, and governance boards.',
      progress: '84%',
      target: 'Q3 Legal Consolidation',
      boards: 4,
      members: 8,
      activeNow: '12m ago',
      color: '#8b8df8',
      tasksCount: 14
    },
    {
      id: 'bisnis-a',
      title: 'Bisnis A',
      category: 'Active Sprint',
      desc: 'Luxury hardware and software design ecosystem. Current initiative centers on public brand identity overhaul and flagship launch.',
      progress: '62%',
      target: 'Launch Readiness: Stage 02/04',
      boards: 5,
      members: 6,
      activeNow: 'Updated now',
      color: '#44e1de',
      primary: true,
      tasksCount: 24
    },
    {
      id: 'pribadi',
      title: 'Pribadi',
      category: 'Confidential',
      desc: 'Personal sanctuary for non-commercial cognition: meditative daily notes, physiological metrics, reading index, and private vault assets.',
      progress: '100%',
      target: '32 Day Habit Consistency',
      boards: 2,
      members: 1,
      activeNow: '1h ago',
      color: '#cebdff',
      tasksCount: 6
    },
    {
      id: 'bisnis-b',
      title: 'Bisnis B',
      category: 'SaaS & Tech',
      desc: 'Cloud native infrastructure and developer toolkit venture. Scaled system microservices, SDK contracts, and API gateway routing.',
      progress: '91%',
      target: 'Q4 Concurrency Benchmark',
      boards: 6,
      members: 4,
      activeNow: '4h ago',
      color: '#00c5c2',
      tasksCount: 19
    }
  ];

  const filtered = () => spacesData.filter(s => 
    s.title.toLowerCase().includes(search().toLowerCase()) || 
    s.desc.toLowerCase().includes(search().toLowerCase()) ||
    s.category.toLowerCase().includes(search().toLowerCase())
  );

  return (
    <div style={{ height: '100vh', display: 'flex', "flex-direction": 'column', "background-color": '#111317', "overflow-y": 'auto' }}>
      {/* Header */}
      <header class="orca-top-header" style={{ position: 'sticky', top: 0, "z-index": 40 }}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <span class="material-symbols-outlined" style={{ "font-size": '18px', color: 'var(--primary)' }}>grid_view</span>
            <span style={{ "font-size": '14px', "font-weight": 500, color: '#fff' }}>All Spaces</span>
          </div>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ "font-size": '11px', "font-family": 'monospace', color: 'var(--outline)', padding: '2px 8px', "border-radius": '4px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)' }}>
            Master Directory
          </span>
        </div>

        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', border: '1px solid var(--border-default)', "border-radius": '4px', "background-color": 'var(--surface-container-lowest)', padding: '2px' }}>
            <button 
              onClick={() => setViewMode('grid')}
              style={{
                padding: '4px 8px',
                "border-radius": '4px',
                border: 'none',
                background: viewMode() === 'grid' ? 'var(--surface-container)' : 'transparent',
                color: viewMode() === 'grid' ? 'var(--primary)' : 'var(--text-dim)',
                cursor: 'pointer'
              }}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '16px', display: 'block' }}>grid_view</span>
            </button>
            <button 
              onClick={() => setViewMode('dense')}
              style={{
                padding: '4px 8px',
                "border-radius": '4px',
                border: 'none',
                background: viewMode() === 'dense' ? 'var(--surface-container)' : 'transparent',
                color: viewMode() === 'dense' ? 'var(--primary)' : 'var(--text-dim)',
                cursor: 'pointer'
              }}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '16px', display: 'block' }}>view_agenda</span>
            </button>
          </div>
          <button 
            onClick={props.onOpenQuickCapture}
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
              "border-radius": '4px',
              cursor: 'pointer'
            }}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
            <span>New Space</span>
          </button>
        </div>
      </header>

      <main style={{ padding: '32px', "max-width": '1360px', margin: '0 auto', width: '100%' }}>
        {/* Top Overview */}
        <div style={{ "margin-bottom": '24px', display: 'flex', "flex-direction": 'column', gap: '8px' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <span style={{ "font-size": '12px', "font-family": 'monospace', "letter-spacing": '0.1em', color: 'var(--primary)', "text-transform": 'uppercase' }}>Master Directory</span>
            <span style={{ width: '4px', height: '4px', "border-radius": '50%', "background-color": 'rgba(255,255,255,0.2)' }}></span>
            <span style={{ "font-size": '12px', "font-family": 'monospace', color: 'var(--text-dim)' }}>v2.4 Spatial Engine</span>
          </div>
          <h1 style={{ "font-size": '24px', "font-weight": 600, color: '#fff', "letter-spacing": '-0.02em', margin: 0 }}>Spaces Hub</h1>
          <p style={{ "font-size": '12px', color: 'var(--text-muted)', "max-width": '580px', margin: 0, "line-height": 1.5 }}>
            Autonomous multi-context environments. Seamlessly partition corporate governance, deep venture architecture, and confidential personal life nodes.
          </p>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', "margin-bottom": '24px' }}>
          {[
            { label: 'Active Spaces', val: '4', sub: '100% Operational', icon: 'layers', color: 'var(--primary)' },
            { label: 'Live Projects', val: '18', sub: 'across 6 nodes', icon: 'alt_route', color: 'var(--secondary)' },
            { label: 'Indexed Docs', val: '142', sub: '+12 this week', icon: 'article', color: 'var(--tertiary)' },
            { label: 'Open Tasks', val: '48', sub: '9 due today', icon: 'check_circle', color: '#34d399' }
          ].map(m => (
            <div style={{ "background-color": 'var(--surface-container-low)', "border-radius": '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '12px', color: 'var(--text-dim)', "text-transform": 'uppercase', "font-family": 'monospace' }}>
                <span>{m.label}</span>
                <span class="material-symbols-outlined" style={{ "font-size": '18px', color: m.color }}>{m.icon}</span>
              </div>
              <div style={{ "margin-top": '8px', display: 'flex', "align-items": 'baseline', gap: '8px' }}>
                <span style={{ "font-size": '24px', "font-weight": 700, color: '#fff' }}>{m.val}</span>
                <span style={{ "font-size": '11px', color: 'var(--text-muted)' }}>{m.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search filter */}
        <div style={{ "margin-bottom": '24px' }}>
          <div style={{ position: 'relative', "max-width": '448px' }}>
            <span class="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', "font-size": '18px', color: 'var(--text-dim)' }}>search</span>
            <input 
              type="text"
              value={search()}
              onInput={e => setSearch(e.currentTarget.value)}
              placeholder="Filter workspaces, pinned schemas, or tags (#luxury, #saas)..."
              style={{
                width: '100%',
                "background-color": 'var(--surface-container-low)',
                color: '#fff',
                "font-size": '12px',
                padding: '8px 16px 8px 40px',
                "border-radius": '8px',
                border: '1px solid var(--border-default)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Spaces Cards Grid */}
        <div style={{ display: 'grid', gap: '24px', "grid-template-columns": viewMode() === 'grid' ? 'repeat(auto-fill, minmax(420px, 1fr))' : '1fr' }}>
          <For each={filtered()}>
            {(space) => (
              <div 
                style={{
                  "background-color": 'rgba(26,28,34,0.6)',
                  "border-radius": '12px',
                  overflow: 'hidden',
                  border: space.primary ? '1px solid rgba(139,141,248,0.4)' : '1px solid var(--border-default)',
                  "box-shadow": space.primary ? '0 0 12px rgba(139,141,248,0.1)' : 'none',
                  display: 'flex',
                  "flex-direction": 'column',
                  "justify-content": 'space-between'
                }}
              >
                <div style={{ padding: '24px', display: 'flex', "flex-direction": 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                      <h2 style={{ "font-size": '18px', "font-weight": 600, color: '#fff', margin: 0 }}>{space.title}</h2>
                      <span style={{ padding: '2px 8px', "border-radius": '4px', "font-size": '10px', "font-family": 'monospace', "text-transform": 'uppercase', "background-color": 'rgba(255,255,255,0.1)', color: '#fff' }}>
                        {space.category}
                      </span>
                    </div>
                    <span style={{ "font-size": '11px', "font-family": 'monospace', color: 'var(--text-dim)', display: 'flex', "align-items": 'center', gap: '4px' }}>
                      <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>schedule</span>
                      {space.activeNow}
                    </span>
                  </div>

                  <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.6 }}>
                    {space.desc}
                  </p>

                  <div style={{ "background-color": 'rgba(12,14,18,0.7)', "border-radius": '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', "font-family": 'monospace', color: 'var(--text-dim)', "margin-bottom": '6px' }}>
                      <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{space.target}</span>
                      <span style={{ color: '#fff', "font-weight": 500 }}>{space.progress}</span>
                    </div>
                    <div style={{ width: '100%', "background-color": 'rgba(255,255,255,0.1)', height: '6px', "border-radius": '9999px', overflow: 'hidden' }}>
                      <div style={{ width: space.progress, height: '100%', "border-radius": '9999px', background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}></div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '12px 24px', "border-top": '1px solid rgba(255,255,255,0.05)', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "background-color": 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                    <button 
                      onClick={() => props.onNavigate('canvas', space.id)}
                      style={{
                        padding: '6px 12px',
                        "border-radius": '4px',
                        "background-color": 'var(--surface-container-high)',
                        color: '#fff',
                        "font-size": '12px',
                        "font-weight": 500,
                        border: 'none',
                        display: 'flex',
                        "align-items": 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span class="material-symbols-outlined" style={{ "font-size": '15px', color: 'var(--primary)' }}>view_quilt</span>
                      <span>Open Canvas</span>
                    </button>
                    <button 
                      onClick={() => props.onNavigate('tasks', space.id)}
                      style={{
                        padding: '6px 12px',
                        "border-radius": '4px',
                        background: 'none',
                        color: 'var(--text-muted)',
                        "font-size": '12px',
                        border: 'none',
                        display: 'flex',
                        "align-items": 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>checklist</span>
                      <span>Tasks ({space.tasksCount})</span>
                    </button>
                  </div>
                  <span style={{ color: 'var(--text-dim)', "font-size": '11px', "font-family": 'monospace' }}>{space.boards} Boards Pinned</span>
                </div>
              </div>
            )}
          </For>
        </div>
      </main>
    </div>
  );
};
