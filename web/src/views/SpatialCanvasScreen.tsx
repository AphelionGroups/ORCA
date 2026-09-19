import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Show } from 'solid-js';

interface SpatialCanvasScreenProps {
  onNavigate: (route: string) => void;
  onOpenQuickCapture: () => void;
}

export const SpatialCanvasScreen: Component<SpatialCanvasScreenProps> = (props) => {
  const [pos1, setPos1] = createSignal({ x: 60, y: 150 });
  const [pos2, setPos2] = createSignal({ x: 440, y: 140 });
  const [pos3, setPos3] = createSignal({ x: 840, y: 140 });
  const [zoom, setZoom] = createSignal(100);
  const [activeTool, setActiveTool] = createSignal('V');
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [mentionText, setMentionText] = createSignal('Brand Guid');

  let draggingState: { nodeId: number; startX: number; startY: number; initialPos: { x: number; y: number } } | null = null;

  const handleMouseDown = (e: MouseEvent, nodeId: number) => {
    const target = e.target as HTMLElement;
    if (['button', 'input', 'textarea', 'a'].includes(target.tagName.toLowerCase())) return;

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

  // Calculate dynamic connector curve between Card 1 right handle and Card 2 left handle
  const connectorPath = () => {
    const p1X = pos1().x + 310;
    const p1Y = pos1().y + 120;
    const p2X = pos2().x;
    const p2Y = pos2().y + 120;
    const dx = Math.abs(p2X - p1X) * 0.5;
    return `M ${p1X} ${p1Y} C ${p1X + dx} ${p1Y}, ${p2X - dx} ${p2Y}, ${p2X} ${p2Y}`;
  };

  return (
    <div style={{ display: 'flex', "flex-direction": 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header with Segmented Tabs */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <span style={{ "font-size": '14px', "font-weight": 500, color: 'var(--text-main)' }}>Bisnis A</span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ "font-size": '14px', color: 'var(--text-muted)' }}>Rebranding & Launch</span>
        </div>

        {/* Center Segmented View Tabs */}
        <div class="segmented-tab-group">
          <button class="segmented-tab-btn active">
            <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--secondary)' }}>gesture</span>
            <span>Canvas</span>
          </button>
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('documents')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>description</span>
            <span>Documents</span>
          </button>
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('tasks')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>check_circle</span>
            <span>Tasks</span>
          </button>
        </div>

        {/* Right Controls */}
        <div class="header-actions">
          <div style={{ display: 'flex', "align-items": 'center', border: '1px solid var(--border-subtle)', "border-radius": '4px', background: '#181a20' }}>
            <button 
              class="btn-ghost-icon" 
              style={{ width: '28px', height: '28px' }} 
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              title="Zoom In"
            >
              <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>zoom_in</span>
            </button>
            <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />
            <button 
              class="btn-ghost-icon" 
              style={{ width: '28px', height: '28px' }} 
              onClick={() => setZoom(100)}
              title="Fit to Screen"
            >
              <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>fit_screen</span>
            </button>
          </div>

          <button class="btn-pill-white" onClick={() => props.onOpenQuickCapture()}>
            <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Spatial Canvas Stage */}
      <main class="spatial-stage">
        <div class="spatial-glow-orb" />

        {/* Viewport with Zoom transform */}
        <div 
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transform: `scale(${zoom() / 100})`,
            "transform-origin": 'center center'
          }}
        >
          {/* Dynamic Smooth SVG Connector */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', "pointer-events": 'none', "z-index": 10 }}>
            <defs>
              <linearGradient id="connectorGlow" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.45" />
                <stop offset="50%" stop-color="#8b8df8" stop-opacity="0.8" />
                <stop offset="100%" stop-color="#44e1de" stop-opacity="0.65" />
              </linearGradient>
              <marker id="dotPoint" markerHeight="6" markerWidth="6" refX="3" refY="3">
                <circle cx="3" cy="3" fill="#44e1de" opacity="0.9" r="2.5" />
              </marker>
            </defs>
            <path 
              d={connectorPath()} 
              fill="none" 
              marker-end="url(#dotPoint)" 
              stroke="url(#connectorGlow)" 
              stroke-dasharray="4 4" 
              stroke-width="1.75"
            />
          </svg>

          {/* CARD 01: STRATEGY (SIGNATURE CHAMFERED CUT CORNER) */}
          <article 
            onMouseDown={(e) => handleMouseDown(e, 1)}
            class="chamfered-node"
            style={{ 
              left: `${pos1().x}px`, 
              top: `${pos1().y}px`,
              width: '310px'
            }}
          >
            {/* Protruding handles */}
            <div class="node-handle" style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)' }}>+</div>
            <div class="node-handle" style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)' }}>+</div>
            <div class="node-handle" style={{ top: '50%', left: '-10px', transform: 'translateY(-50%)' }}>+</div>
            <div class="node-handle node-handle-active-primary" style={{ top: '50%', right: '-10px', transform: 'translateY(-50%)' }}>+</div>

            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '14px' }}>
              <span style={{ "font-size": '11px', "font-weight": 500, "text-transform": 'uppercase', "letter-spacing": '0.15em', color: 'var(--text-dim)' }}>
                Strategy
              </span>
              <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>01</span>
            </div>

            <h2 style={{ "font-size": '15px', "font-weight": 600, color: 'var(--text-main)', "margin-bottom": '12px', "letter-spacing": '-0.2px' }}>
              Brand Identity & Value Pillars
            </h2>

            <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px', "font-size": '12px', color: 'var(--text-muted)', "line-height": 1.6 }}>
              <p><span style={{ color: 'var(--text-main)', "font-weight": 500 }}>— Restraint over noise:</span> hyper-intentional negative space and pure typographic hierarchy.</p>
              <p><span style={{ color: 'var(--text-main)', "font-weight": 500 }}>— Material depth:</span> obsidian glass, muted ash tones, chamfered precision geometry.</p>
              <p><span style={{ color: 'var(--text-main)', "font-weight": 500 }}>— Context isolation:</span> domain switching without cognitive fragmentation.</p>
            </div>
          </article>

          {/* CARD 02: IDEATION */}
          <article 
            onMouseDown={(e) => handleMouseDown(e, 2)}
            class="chamfered-node"
            style={{ 
              left: `${pos2().x}px`, 
              top: `${pos2().y}px`,
              width: '340px'
            }}
          >
            <div class="node-handle node-handle-active-secondary" style={{ top: '50%', left: '-10px', transform: 'translateY(-50%)' }}>+</div>
            <div class="node-handle" style={{ top: '50%', right: '-10px', transform: 'translateY(-50%)' }}>+</div>

            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '12px' }}>
              <span style={{ "font-size": '11px', "font-weight": 500, "text-transform": 'uppercase', "letter-spacing": '0.15em', color: 'var(--text-dim)' }}>
                Ideation
              </span>
              <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>02</span>
            </div>

            <h2 style={{ "font-size": '15px', "font-weight": 600, color: 'var(--text-main)', "margin-bottom": '8px', "letter-spacing": '-0.2px' }}>
              The Architects of Silence
            </h2>

            <p style={{ "font-size": '12px', color: 'var(--text-muted)', "line-height": 1.6, "margin-bottom": '14px' }}>
              Positioning ORCA as an intentional deprivation chamber for high-leverage creative decisions.
            </p>

            {/* Inline @ mention active input */}
            <div style={{ position: 'relative', "margin-bottom": '12px' }}>
              <div 
                onClick={() => setMentionOpen(!mentionOpen())}
                style={{
                  display: 'flex',
                  "align-items": 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#111317',
                  border: '1px solid rgba(255,255,255,0.2)',
                  "border-radius": '4px',
                  "font-size": '12px',
                  "font-family": 'var(--font-mono)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <span style={{ color: 'var(--secondary)', "font-weight": 700, background: 'rgba(68,225,222,0.1)', padding: '2px 6px', "border-radius": '4px' }}>@</span>
                <span>{mentionText()}</span>
                <span style={{ display: 'inline-block', width: '6px', height: '14px', background: 'white' }} />
              </div>

              <Show when={mentionOpen()}>
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  "margin-top": '6px',
                  background: '#191b22',
                  border: '1px solid rgba(255,255,255,0.15)',
                  "box-shadow": '0 20px 40px rgba(0,0,0,0.6)',
                  "border-radius": '4px',
                  padding: '4px',
                  "z-index": 50,
                  "backdrop-filter": 'blur(12px)'
                }}>
                  <div style={{ padding: '6px 10px', "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--text-dim)', "border-bottom": '1px solid rgba(255,255,255,0.06)' }}>
                    Link or Create Draft
                  </div>
                  <button 
                    style={{ width: '100%', display: 'flex', "align-items": 'center', "justify-content": 'space-between', padding: '8px 10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', "text-align": 'left' }}
                    onClick={() => { setMentionText('New Doc Draft'); setMentionOpen(false); }}
                  >
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                      <span class="material-symbols-outlined" style={{ "font-size": '15px', color: 'var(--secondary)' }}>note_add</span>
                      <span style={{ "font-size": '12px', "font-weight": 500 }}>+ New Document draft</span>
                    </div>
                    <span style={{ "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>Draft</span>
                  </button>
                  <button 
                    style={{ width: '100%', display: 'flex', "align-items": 'center', "justify-content": 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: 'none', color: 'white', cursor: 'pointer', "text-align": 'left' }}
                    onClick={() => { setMentionText('Q3 Brand Guidelines'); setMentionOpen(false); }}
                  >
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                      <span class="material-symbols-outlined" style={{ "font-size": '15px', color: 'var(--text-muted)' }}>description</span>
                      <span style={{ "font-size": '12px', "font-weight": 500 }}>Q3 Brand Guidelines</span>
                    </div>
                    <span style={{ "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>Doc</span>
                  </button>
                </div>
              </Show>
            </div>

            <button 
              onClick={() => props.onOpenQuickCapture()}
              style={{
                width: '100%',
                padding: '8px 12px',
                "font-size": '12px',
                "font-weight": 500,
                color: 'white',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                "border-radius": '4px',
                cursor: 'pointer'
              }}
            >
              Create Task
            </button>
          </article>

          {/* CARD 03: QUICK DRAFT & LINK ASIDE */}
          <aside 
            onMouseDown={(e) => handleMouseDown(e, 3)}
            class="chamfered-node"
            style={{ 
              left: `${pos3().x}px`, 
              top: `${pos3().y}px`,
              width: '320px',
              padding: '16px'
            }}
          >
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-bottom": '8px', "margin-bottom": '12px', "border-bottom": '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                <span class="material-symbols-outlined" style={{ "font-size": '16px', color: 'var(--secondary)' }}>note_add</span>
                <span style={{ "font-size": '12.5px', "font-weight": 600, color: 'white' }}>Quick Draft & Link</span>
              </div>
              <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>Pinned</span>
            </div>

            <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px' }}>
                <span style={{ "font-family": 'var(--font-mono)', color: 'var(--text-dim)', "text-transform": 'uppercase' }}>Type</span>
                <div style={{ display: 'flex', gap: '4px', background: '#111317', border: '1px solid var(--border-subtle)', padding: '2px', "border-radius": '4px' }}>
                  <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.1)', color: 'white', "border-radius": '3px', "font-weight": 500 }}>Doc</span>
                  <span style={{ padding: '2px 8px', color: 'var(--text-muted)' }}>Task</span>
                </div>
              </div>

              <input 
                readOnly 
                value="Packaging Visual Hierarchy & Specs"
                style={{ width: '100%', background: '#111317', border: '1px solid var(--border-subtle)', padding: '6px 10px', "border-radius": '4px', color: 'white', "font-size": '12px' }}
              />

              <textarea 
                readOnly 
                rows={2} 
                value="Align typographic contrast and box-die cut margin with luxury voice."
                style={{ width: '100%', background: '#111317', border: '1px solid var(--border-subtle)', padding: '6px 10px', "border-radius": '4px', color: 'var(--text-muted)', "font-size": '12px', resize: 'none' }}
              />

              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '6px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '11px' }}>
                <span style={{ "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>Bisnis A</span>
                <button 
                  onClick={() => props.onNavigate('documents')}
                  class="btn-pill-white"
                  style={{ padding: '4px 10px', "font-size": '11px' }}
                >
                  <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>link</span>
                  <span>Open Doc</span>
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* FLOATING CANVAS TOOLBAR */}
        <div class="floating-canvas-toolbar">
          {[
            { id: 'V', icon: 'near_me', tip: 'Select (V)' },
            { id: 'H', icon: 'pan_tool', tip: 'Pan (H)' },
            { id: 'R', icon: 'rectangle', tip: 'Shapes (R)' },
            { id: 'C', icon: 'moving', tip: 'Connector (C)' },
            { id: 'T', icon: 'title', tip: 'Text (T)' },
            { id: 'F', icon: 'crop_free', tip: 'Frame (F)' },
            { id: 'P', icon: 'edit', tip: 'Draw (P)' },
            { id: 'M', icon: 'account_tree', tip: 'Mindmap (M)' }
          ].map(t => (
            <button
              onClick={() => setActiveTool(t.id)}
              class={`canvas-tool-btn ${activeTool() === t.id ? 'active' : ''}`}
              title={t.tip}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px' }}>{t.icon}</span>
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          <button 
            onClick={() => setMentionOpen(true)}
            style={{ display: 'flex', "align-items": 'center', gap: '4px', padding: '0 8px', height: '32px', "border-radius": '8px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', "font-size": '11px', "font-weight": 500 }}
          >
            <span style={{ "font-family": 'var(--font-mono)', color: 'var(--secondary)', background: 'rgba(68,225,222,0.1)', padding: '2px 5px', "border-radius": '4px' }}>@</span>
            <span>Ref</span>
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          <div style={{ display: 'flex', "align-items": 'center', gap: '2px', "font-family": 'var(--font-mono)', "font-size": '11px' }}>
            <button class="btn-ghost-icon" style={{ width: '24px', height: '24px' }} onClick={() => setZoom(z => Math.max(50, z - 10))}>−</button>
            <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>{zoom()}%</span>
            <button class="btn-ghost-icon" style={{ width: '24px', height: '24px' }} onClick={() => setZoom(z => Math.min(150, z + 10))}>+</button>
          </div>
        </div>
      </main>
    </div>
  );
};
