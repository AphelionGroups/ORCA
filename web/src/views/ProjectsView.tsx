import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { 
  FolderKanban, 
  FileText, 
  LayoutGrid, 
  CheckSquare, 
  Plus, 
  MousePointer, 
  Hand, 
  Square, 
  Share2, 
  Type
} from 'lucide-solid';

interface ProjectsViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

export const ProjectsView: Component<ProjectsViewProps> = (props) => {
  // Active Project & Tab state
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>('proj-rebrand');
  const [activeTab, setActiveTab] = createSignal<'docs' | 'board' | 'tasks'>('board');

  // Spatial Canvas Draggable state
  const [pos1, setPos1] = createSignal({ x: 60, y: 150 });
  const [pos2, setPos2] = createSignal({ x: 440, y: 140 });
  const [pos3, setPos3] = createSignal({ x: 840, y: 140 });
  const [zoom, setZoom] = createSignal(100);
  const [activeCanvasTool, setActiveCanvasTool] = createSignal('select');

  // Documents Tab state
  const [selectedDoc, setSelectedDoc] = createSignal('Brand Identity & Strategy');

  let draggingState: { nodeId: number; startX: number; startY: number; initialPos: { x: number; y: number } } | null = null;

  const handleMouseDown = (e: MouseEvent, nodeId: number) => {
    const target = e.target as HTMLElement;
    if (['button', 'input', 'textarea', 'a', 'select'].includes(target.tagName.toLowerCase())) return;

    const initial = nodeId === 1 ? { ...pos1() } : nodeId === 2 ? { ...pos2() } : { ...pos3() };
    draggingState = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      initialPos: initial
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingState) return;
    const { nodeId, startX, startY, initialPos } = draggingState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (nodeId === 1) setPos1({ x: Math.max(20, initialPos.x + dx), y: Math.max(20, initialPos.y + dy) });
    if (nodeId === 2) setPos2({ x: Math.max(20, initialPos.x + dx), y: Math.max(20, initialPos.y + dy) });
    if (nodeId === 3) setPos3({ x: Math.max(20, initialPos.x + dx), y: Math.max(20, initialPos.y + dy) });
  };

  const handleMouseUp = () => {
    draggingState = null;
  };

  onMount(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });

  const connectorPath = () => {
    const p1X = pos1().x + 310;
    const p1Y = pos1().y + 115;
    const p2X = pos2().x;
    const p2Y = pos2().y + 115;
    const deltaX = Math.max(40, (p2X - p1X) * 0.5);
    return `M ${p1X} ${p1Y} C ${p1X + deltaX} ${p1Y}, ${p2X - deltaX} ${p2Y}, ${p2X} ${p2Y}`;
  };

  // Sample Projects
  const projects = [
    {
      id: 'proj-rebrand',
      name: 'Rebranding & Launch',
      spaceName: 'Bisnis A',
      status: 'Active Sprint',
      desc: 'Luxury hardware & software design ecosystem overhaul and flagship launch readiness.',
      docsCount: 4,
      tasksCount: 24,
      boardsCount: 5,
      progress: '62%'
    },
    {
      id: 'proj-packaging',
      name: 'Packaging CAD & Dieline',
      spaceName: 'Bisnis A',
      status: 'Planning',
      desc: '3D specular maps, carton tensile specs, and luxury unboxing tactile architecture.',
      docsCount: 2,
      tasksCount: 8,
      boardsCount: 2,
      progress: '35%'
    },
    {
      id: 'proj-infra',
      name: 'Cloud Microservices v2',
      spaceName: 'Bisnis B',
      status: 'In Review',
      desc: 'Distributed API gateway routing, local-first CRDT sync engine, and PostgreSQL partitioning.',
      docsCount: 6,
      tasksCount: 19,
      boardsCount: 4,
      progress: '91%'
    }
  ];

  const currentProject = () => projects.find(p => p.id === selectedProjectId()) || projects[0];

  return (
    <div style={{ height: '100vh', display: 'flex', "flex-direction": 'column', "background-color": '#111317', overflow: 'hidden' }}>
      
      {/* Project Hub Header */}
      <header class="orca-top-header" style={{ position: 'sticky', top: 0, "z-index": 40 }}>
        {/* Left: Breadcrumbs / Project selector */}
        <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '13px' }}>
          <button 
            onClick={() => setSelectedProjectId(null)}
            style={{ display: 'flex', "align-items": 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <FolderKanban size={15} color="var(--primary)" />
            <span>Projects</span>
          </button>
          
          <Show when={selectedProjectId()}>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            <span style={{ color: '#fff', "font-weight": 600, display: 'flex', "align-items": 'center', gap: '8px' }}>
              <span style={{ width: '7px', height: '7px', "border-radius": '2px', "background-color": 'var(--secondary)' }}></span>
              {currentProject().name}
            </span>
          </Show>
        </div>

        {/* Center: The 3 Core Project Hub Tabs (FR-HUB-01) */}
        <Show when={selectedProjectId()}>
          <div class="segmented-control">
            <button 
              class={`seg-item ${activeTab() === 'docs' ? 'active' : ''}`}
              onClick={() => setActiveTab('docs')}
            >
              <FileText size={13} color={activeTab() === 'docs' ? 'var(--tertiary)' : 'var(--text-dim)'} />
              <span>Docs & Plans</span>
            </button>
            <button 
              class={`seg-item ${activeTab() === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
            >
              <LayoutGrid size={13} color={activeTab() === 'board' ? 'var(--secondary)' : 'var(--text-dim)'} />
              <span>Board</span>
            </button>
            <button 
              class={`seg-item ${activeTab() === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <CheckSquare size={13} color={activeTab() === 'tasks' ? 'var(--primary)' : 'var(--text-dim)'} />
              <span>Tasks</span>
            </button>
          </div>
        </Show>

        {/* Right Controls */}
        <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
          <button 
            onClick={props.onOpenQuickCapture}
            style={{
              display: 'flex',
              "align-items": 'center',
              gap: '6px',
              padding: '5px 12px',
              "font-size": '12px',
              "font-weight": 500,
              color: '#000',
              "background-color": '#fff',
              border: 'none',
              "border-radius": '4px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>New Item</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <Show when={!selectedProjectId()} fallback={
        /* -------------------------------------------------------------
           PROJECT HUB ACTIVE VIEW (DOCS | BOARD | TASKS)
           ------------------------------------------------------------- */
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          
          {/* TAB 1: DOCS & PLANS */}
          <Show when={activeTab() === 'docs'}>
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              {/* Left Doc Index */}
              <aside style={{ width: '280px', "background-color": 'var(--surface-container-low)', "border-right": '1px solid var(--border-default)', padding: '16px', display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                <div style={{ "font-size": '11px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--text-dim)', "margin-bottom": '6px' }}>
                  Project Documentation
                </div>
                <For each={['Brand Identity & Strategy', 'Packaging Visual Hierarchy & Specs', 'Q3 Product Lineup Blueprint', 'Market Positioning Whitepaper']}>
                  {(docTitle) => (
                    <div 
                      onClick={() => setSelectedDoc(docTitle)}
                      style={{
                        padding: '10px 12px',
                        "border-radius": '6px',
                        "background-color": selectedDoc() === docTitle ? 'var(--surface-container-high)' : 'transparent',
                        border: selectedDoc() === docTitle ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                        color: selectedDoc() === docTitle ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        "font-size": '12px',
                        display: 'flex',
                        "align-items": 'center',
                        gap: '8px'
                      }}
                    >
                      <FileText size={14} color={selectedDoc() === docTitle ? 'var(--tertiary)' : 'var(--text-dim)'} />
                      <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{docTitle}</span>
                    </div>
                  )}
                </For>
              </aside>

              {/* Right Editorial View */}
              <main style={{ flex: 1, "overflow-y": 'auto', padding: '40px 64px', "background-color": '#111317' }}>
                <div style={{ "max-width": '760px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--secondary)' }}>
                    <span>STAGE 02 / LAUNCH ASSETS</span>
                  </div>

                  <h1 style={{ "font-size": '32px', "font-weight": 700, color: '#fff', "letter-spacing": '-0.02em', margin: 0 }}>
                    {selectedDoc()}
                  </h1>

                  <blockquote style={{
                    "border-left": '2px solid var(--secondary)',
                    padding: '8px 16px',
                    margin: 0,
                    "font-style": 'italic',
                    color: 'var(--text-muted)',
                    "font-size": '14px',
                    "background-color": 'rgba(68, 225, 222, 0.04)',
                    "border-radius": '0 4px 4px 0'
                  }}>
                    "Simplicity is not the absence of clutter, that's a consequence of simplicity. Simplicity somehow essentially describes the purpose and place of an object and product."
                  </blockquote>

                  <p style={{ "font-size": '14px', "line-height": 1.7, color: 'var(--text-muted)', margin: 0 }}>
                    The core identity architecture pivots on three structural pillars: <strong>Restraint</strong>, <strong>Material Honesty</strong>, and <strong>Spatial Cohesion</strong>. All subsequent collateral—from physical packaging die-cuts to procedural shaders—must adhere to these coordinates.
                  </p>

                  {/* Color Palette Swatches */}
                  <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
                    <h3 style={{ "font-size": '13px', "font-weight": 600, color: '#fff', margin: 0 }}>Primary Chromatic Scale</h3>
                    <div style={{ display: 'grid', "grid-template-columns": 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ padding: '12px', "border-radius": '6px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                        <span style={{ width: '20px', height: '20px', "border-radius": '4px', "background-color": '#8b8df8' }}></span>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: '#fff' }}>Primary #8b8df8</span>
                      </div>
                      <div style={{ padding: '12px', "border-radius": '6px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                        <span style={{ width: '20px', height: '20px', "border-radius": '4px', "background-color": '#44e1de' }}></span>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: '#fff' }}>Cyan #44e1de</span>
                      </div>
                      <div style={{ padding: '12px', "border-radius": '6px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                        <span style={{ width: '20px', height: '20px', "border-radius": '4px', "background-color": '#cebdff' }}></span>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: '#fff' }}>Lilac #cebdff</span>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </Show>

          {/* TAB 2: BOARD (SPATIAL CANVAS) */}
          <Show when={activeTab() === 'board'}>
            <div style={{ position: 'relative', width: '100%', height: '100%', "background-color": '#111317', overflow: 'hidden' }}>
              {/* Dot Grid Background */}
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  "background-image": 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
                  "background-size": '24px 24px',
                  "pointer-events": 'none'
                }}
              />

              {/* Dynamic SVG Connector Curve */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', "pointer-events": 'none', "z-index": 10 }}>
                <path 
                  d={connectorPath()} 
                  fill="none" 
                  stroke="var(--secondary)" 
                  stroke-width="2" 
                  stroke-dasharray="4 4"
                  opacity="0.8"
                />
              </svg>

              {/* CARD 01: STRATEGY NOTE */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 1)}
                style={{
                  position: 'absolute',
                  left: `${pos1().x}px`,
                  top: `${pos1().y}px`,
                  width: '310px',
                  "background-color": '#181a20',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  "border-radius": '6px',
                  padding: '16px',
                  "z-index": 20,
                  cursor: 'grab',
                  "box-shadow": '0 20px 40px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '12px' }}>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--secondary)', background: 'rgba(68,225,222,0.1)', padding: '2px 6px', "border-radius": '3px' }}>
                    01 • Strategy Node
                  </span>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>Pinned</span>
                </div>
                <h3 style={{ "font-size": '14px', "font-weight": 600, color: '#fff', margin: '0 0 8px 0' }}>
                  Brand Identity Core Pillars
                </h3>
                <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                  Synthesize architectural brutalism with Nordic luxury restraint. Pure Obsidian base tone with secondary neon accents.
                </p>
                <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": '14px', "padding-top": '10px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '11px', color: 'var(--text-dim)' }}>
                  <span>3 Subnodes linked</span>
                  <span style={{ color: 'var(--secondary)' }}>Active</span>
                </div>
              </div>

              {/* CARD 02: ACTION NODE & LINK */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 2)}
                style={{
                  position: 'absolute',
                  left: `${pos2().x}px`,
                  top: `${pos2().y}px`,
                  width: '320px',
                  "background-color": '#181a20',
                  border: '1px solid rgba(68, 225, 222, 0.3)',
                  "border-radius": '6px',
                  padding: '16px',
                  "z-index": 20,
                  cursor: 'grab',
                  "box-shadow": '0 20px 40px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '12px' }}>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--primary)', background: 'rgba(139,141,248,0.1)', padding: '2px 6px', "border-radius": '3px' }}>
                    02 • Connected Action
                  </span>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>Synced</span>
                </div>
                <h3 style={{ "font-size": '14px', "font-weight": 600, color: '#fff', margin: '0 0 8px 0' }}>
                  CAD Packaging Specifications
                </h3>
                <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                  Spot varnishes, box-die cut margin with luxury tactile feeling. Directly linked to factory sprint.
                </p>
                <div style={{ display: 'flex', gap: '8px', "margin-top": '14px' }}>
                  <button 
                    onClick={() => setActiveTab('docs')}
                    style={{ flex: 1, padding: '6px', "background-color": 'var(--surface-container-high)', border: '1px solid var(--border-default)', "border-radius": '4px', color: '#fff', "font-size": '11px', cursor: 'pointer', display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '4px' }}
                  >
                    <FileText size={12} />
                    <span>View Doc</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('tasks')}
                    style={{ flex: 1, padding: '6px', "background-color": 'rgba(68,225,222,0.1)', border: '1px solid rgba(68,225,222,0.3)', "border-radius": '4px', color: 'var(--secondary)', "font-size": '11px', cursor: 'pointer', display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '4px' }}
                  >
                    <CheckSquare size={12} />
                    <span>Open Task</span>
                  </button>
                </div>
              </div>

              {/* CARD 03: CHAMFERED QUICK DRAFT */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 3)}
                style={{
                  position: 'absolute',
                  left: `${pos3().x}px`,
                  top: `${pos3().y}px`,
                  width: '320px',
                  "background-color": '#181a20',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  "border-radius": '6px',
                  "clip-path": 'polygon(0px 0px, calc(100% - 14px) 0px, 100% 14px, 100% 100%, 0px 100%)',
                  padding: '16px',
                  "z-index": 20,
                  cursor: 'grab',
                  "box-shadow": '0 20px 40px rgba(0, 0, 0, 0.5)'
                }}
              >
                <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '12px' }}>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--tertiary)', background: 'rgba(206,189,255,0.1)', padding: '2px 6px', "border-radius": '3px' }}>
                    03 • Quick Draft & Link
                  </span>
                  <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>Chamfered</span>
                </div>
                <input 
                  readOnly 
                  value="Packaging Visual Hierarchy & Specs"
                  style={{ width: '100%', "background-color": '#111317', border: '1px solid var(--border-default)', "border-radius": '4px', padding: '6px 10px', "font-size": '12px', color: '#fff', "margin-bottom": '8px', outline: 'none' }}
                />
                <textarea 
                  readOnly 
                  rows={2} 
                  value="Align typographic contrast and box-die cut margin with luxury voice."
                  style={{ width: '100%', "background-color": '#111317', border: '1px solid var(--border-default)', "border-radius": '4px', padding: '6px 10px', "font-size": '11px', color: 'var(--text-muted)', outline: 'none', resize: 'none' }}
                />
              </div>

              {/* Floating Canvas Toolbar */}
              <div class="canvas-toolbar">
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'select' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('select')}
                  title="Select (V)"
                >
                  <MousePointer size={15} />
                </button>
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'pan' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('pan')}
                  title="Pan (H)"
                >
                  <Hand size={15} />
                </button>
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'shapes' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('shapes')}
                  title="Shapes (R)"
                >
                  <Square size={15} />
                </button>
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'connector' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('connector')}
                  title="Connector (C)"
                >
                  <Share2 size={15} />
                </button>
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('text')}
                  title="Text (T)"
                >
                  <Type size={15} />
                </button>

                <div style={{ width: '1px', height: '16px', "background-color": 'rgba(255,255,255,0.1)', margin: '0 4px' }}></div>

                <div style={{ display: 'flex', "align-items": 'center', gap: '2px', "font-size": '11px', "font-family": 'var(--font-mono)' }}>
                  <button onClick={() => setZoom(z => Math.max(50, z - 10))} class="tool-btn" style={{ width: '24px', height: '24px' }}>-</button>
                  <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>{zoom()}%</span>
                  <button onClick={() => setZoom(z => Math.min(150, z + 10))} class="tool-btn" style={{ width: '24px', height: '24px' }}>+</button>
                </div>
              </div>
            </div>
          </Show>

          {/* TAB 3: TASKS (PROJECT KANBAN) */}
          <Show when={activeTab() === 'tasks'}>
            <div style={{ height: '100%', "overflow-y": 'auto', padding: '24px 32px', "background-color": '#111317' }}>
              <div style={{ display: 'grid', "grid-template-columns": 'repeat(4, minmax(260px, 1fr))', gap: '16px', "align-items": 'flex-start' }}>
                {[
                  {
                    title: 'Backlog',
                    color: 'var(--outline-variant)',
                    tasks: [
                      { id: '#TSK-102', title: 'Competitor Typography Benchmark', priority: 'P4', date: 'May 14', user: 'AR' },
                      { id: '#TSK-108', title: '3D Asset Render Specs', priority: 'P2', date: 'May 18', user: 'DL' }
                    ]
                  },
                  {
                    title: 'In Progress',
                    color: 'var(--primary)',
                    tasks: [
                      { id: '#TSK-097', title: 'Finalize Packaging Print Specs', priority: 'Urgent', date: 'Tomorrow', user: 'HN', urgent: true },
                      { id: '#TSK-104', title: 'Obsidian Glass Calibration', priority: 'P1', date: 'May 16', user: 'VR' }
                    ]
                  },
                  {
                    title: 'In Review',
                    color: 'var(--tertiary)',
                    tasks: [
                      { id: '#TSK-089', title: 'Brand Identity Guidelines v1.2', priority: 'P1', date: 'Waiting on CEO', user: 'FA' }
                    ]
                  },
                  {
                    title: 'Done',
                    color: 'var(--secondary)',
                    tasks: [
                      { id: '#TSK-078', title: 'Core Value Pillars Definition', priority: 'Done', date: 'May 10', user: 'DL' }
                    ]
                  }
                ].map(col => (
                  <div style={{ padding: '12px', "border-radius": '8px', "background-color": 'var(--surface-container-low)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', "flex-direction": 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', "border-radius": '50%', "background-color": col.color }}></span>
                        <span style={{ "font-size": '12px', "font-weight": 600, color: '#fff' }}>{col.title}</span>
                      </div>
                      <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', padding: '1px 5px', "border-radius": '3px', "background-color": 'rgba(255,255,255,0.05)' }}>
                        {col.tasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                      <For each={col.tasks}>
                        {(t) => (
                          <div style={{ padding: '12px', "border-radius": '6px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)', display: 'flex', "flex-direction": 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                              <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>{t.id}</span>
                              <span style={{ "font-size": '9px', "font-family": 'var(--font-mono)', padding: '1px 5px', "border-radius": '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{t.priority}</span>
                            </div>
                            <h4 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>{t.title}</h4>
                            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                              <span>{t.date}</span>
                              <span>{t.user}</span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Show>

        </div>
      }>
        {/* -------------------------------------------------------------
           PROJECT DIRECTORY VIEW (When no project is opened)
           ------------------------------------------------------------- */}
        <main style={{ flex: 1, "overflow-y": 'auto', padding: '32px', "background-color": '#111317' }}>
          <div style={{ "max-width": '1100px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '24px' }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <div>
                <h1 style={{ "font-size": '22px', "font-weight": 600, color: '#fff', margin: 0 }}>Projects</h1>
                <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Wadah inisiatif terpadu: satukan Dokumen Strategi, Spatial Board Milanote, dan Tasks Kanban.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              <For each={projects}>
                {(proj) => (
                  <div 
                    onClick={() => setSelectedProjectId(proj.id)}
                    style={{
                      padding: '20px',
                      "border-radius": '8px',
                      "background-color": 'var(--surface-container-low)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      "flex-direction": 'column',
                      "justify-content": 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                        <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--secondary)', background: 'rgba(68,225,222,0.1)', padding: '2px 6px', "border-radius": '3px' }}>
                          {proj.spaceName}
                        </span>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                          {proj.status}
                        </span>
                      </div>

                      <h3 style={{ "font-size": '15px', "font-weight": 600, color: '#fff', margin: 0 }}>
                        {proj.name}
                      </h3>

                      <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                        {proj.desc}
                      </p>
                    </div>

                    <div style={{ "margin-top": '16px', "padding-top": '12px', "border-top": '1px solid rgba(255,255,255,0.05)', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span>{proj.docsCount} Docs</span>
                        <span>·</span>
                        <span>{proj.boardsCount} Boards</span>
                        <span>·</span>
                        <span>{proj.tasksCount} Tasks</span>
                      </div>
                      <span style={{ color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>{proj.progress}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </main>
      </Show>

    </div>
  );
};
