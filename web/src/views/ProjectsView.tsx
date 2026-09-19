import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
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
  Type,
  ChevronRight,
  RotateCcw
} from 'lucide-solid';
import { api } from '../services/api';
import type { Project, Space, Document as OrcaDoc, NoteBoard, NoteBlock, Task } from '../services/api';

interface ProjectsViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

export const ProjectsView: Component<ProjectsViewProps> = (props) => {
  // Projects & Spaces from Backend
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [loadingProjects, setLoadingProjects] = createSignal(true);

  // Active Project & Tab state
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<'docs' | 'board' | 'tasks'>('board');

  // Sub-entity states for active project
  const [docs, setDocs] = createSignal<OrcaDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = createSignal<string | null>(null);
  const [boards, setBoards] = createSignal<NoteBoard[]>([]);
  const [blocks, setBlocks] = createSignal<NoteBlock[]>([]);
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [loadingSubData, setLoadingSubData] = createSignal(false);

  // Canvas Viewport & Tool state
  const [zoom, setZoom] = createSignal(100);
  const [activeCanvasTool, setActiveCanvasTool] = createSignal('select');

  // Quick task input in board/tasks tab
  const [newTaskTitle, setNewTaskTitle] = createSignal('');
  const [activeNewTaskCol, setActiveNewTaskCol] = createSignal<string | null>(null);

  // Dragging state for canvas blocks
  let draggingBlockState: { blockId: string; startX: number; startY: number; initialX: number; initialY: number } | null = null;

  // Load all projects and spaces
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const [fetchedProjects, fetchedSpaces] = await Promise.all([
        api.getProjects(props.activeSpaceId || undefined),
        api.getSpaces()
      ]);
      setProjects(fetchedProjects || []);
      setSpaces(fetchedSpaces || []);

      // If no project selected yet, select first project
      if (!selectedProjectId() && fetchedProjects && fetchedProjects.length > 0) {
        setSelectedProjectId(fetchedProjects[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  onMount(() => {
    loadProjects();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });

  // Re-fetch projects if activeSpaceId changes
  createEffect(() => {
    const spaceId = props.activeSpaceId;
    api.getProjects(spaceId || undefined).then(res => {
      setProjects(res || []);
      if (res && res.length > 0 && (!selectedProjectId() || !res.some(p => p.id === selectedProjectId()))) {
        setSelectedProjectId(res[0].id);
      }
    }).catch(console.error);
  });

  // Load Project Detail sub-entities when selectedProjectId changes
  createEffect(async () => {
    const pId = selectedProjectId();
    if (!pId) return;

    setLoadingSubData(true);
    try {
      const [fetchedDocs, fetchedBoards, fetchedTasks] = await Promise.all([
        api.getDocuments({ project_id: pId }),
        api.getBoards({ project_id: pId }),
        api.getTasks({ project_id: pId })
      ]);

      setDocs(fetchedDocs || []);
      if (fetchedDocs && fetchedDocs.length > 0) {
        setSelectedDocId(fetchedDocs[0].id);
      } else {
        setSelectedDocId(null);
      }

      setBoards(fetchedBoards || []);
      if (fetchedBoards && fetchedBoards.length > 0) {
        const fetchedBlocks = await api.getBoardBlocks(fetchedBoards[0].id);
        setBlocks(fetchedBlocks || []);
      } else {
        setBlocks([]);
      }

      setTasks(fetchedTasks || []);
    } catch (err) {
      console.error('Failed to load project sub-data:', err);
    } finally {
      setLoadingSubData(false);
    }
  });

  const currentProject = () => projects().find(p => p.id === selectedProjectId()) || projects()[0];
  const currentDoc = () => docs().find(d => d.id === selectedDocId()) || docs()[0];
  const getSpaceName = (spaceId?: string) => {
    if (!spaceId) return 'Workspace';
    return spaces().find(s => s.id === spaceId)?.name || 'Space';
  };

  // Canvas Mouse Dragging
  const handleMouseDown = (e: MouseEvent, block: NoteBlock) => {
    const target = e.target as HTMLElement;
    if (['button', 'input', 'textarea', 'a', 'select'].includes(target.tagName.toLowerCase())) return;

    draggingBlockState = {
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: block.pos_x,
      initialY: block.pos_y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingBlockState) return;
    const { blockId, startX, startY, initialX, initialY } = draggingBlockState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setBlocks(blocks().map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          pos_x: Math.max(20, initialX + dx),
          pos_y: Math.max(20, initialY + dy)
        };
      }
      return b;
    }));
  };

  const handleMouseUp = async () => {
    if (!draggingBlockState) return;
    const blockId = draggingBlockState.blockId;
    draggingBlockState = null;

    const block = blocks().find(b => b.id === blockId);
    if (block) {
      try {
        await api.updateNoteBlock(block.id, {
          pos_x: Math.round(block.pos_x),
          pos_y: Math.round(block.pos_y)
        });
      } catch (err) {
        console.error('Failed to persist block position:', err);
      }
    }
  };

  // Dynamic SVG connector path between the first two blocks
  const connectorPath = () => {
    const blist = blocks();
    if (blist.length < 2) return '';
    const b1 = blist[0];
    const b2 = blist[1];
    const p1X = b1.pos_x + (b1.width || 310);
    const p1Y = b1.pos_y + 115;
    const p2X = b2.pos_x;
    const p2Y = b2.pos_y + 115;
    const deltaX = Math.max(40, (p2X - p1X) * 0.5);
    return `M ${p1X} ${p1Y} C ${p1X + deltaX} ${p1Y}, ${p2X - deltaX} ${p2Y}, ${p2X} ${p2Y}`;
  };

  // Task Status Cycling in Kanban
  const handleCycleTaskStatus = async (task: Task) => {
    const statusCycle: Record<string, Task['status']> = {
      'todo': 'in_progress',
      'in_progress': 'in_review',
      'in_review': 'done',
      'done': 'todo'
    };
    const nextStatus = statusCycle[task.status] || 'in_progress';
    try {
      await api.updateTaskStatus(task.id, nextStatus);
      setTasks(tasks().map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  // Create task in specific column
  const handleCreateTaskInCol = async (status: Task['status']) => {
    const title = newTaskTitle().trim();
    if (!title) return;
    const proj = currentProject();
    if (!proj) return;

    try {
      const created = await api.createTask({
        title,
        project_id: proj.id,
        space_id: proj.space_id,
        status,
        priority: 'medium'
      });
      setTasks([...tasks(), created]);
      setNewTaskTitle('');
      setActiveNewTaskCol(null);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Create new document
  const handleCreateNewDoc = async () => {
    const proj = currentProject();
    if (!proj) return;

    try {
      const newDoc = await api.createDocument({
        project_id: proj.id,
        space_id: proj.space_id,
        title: `Document ${docs().length + 1}`,
        doc_type: 'notes',
        content: 'Write editorial markdown notes and strategic architecture guidelines here...',
        is_pinned: false
      });
      setDocs([newDoc, ...docs()]);
      setSelectedDocId(newDoc.id);
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>
      
      {/* Project Hub Header */}
      <header class="orca-header">
        {/* Left: Breadcrumbs / Project selector */}
        <div class="header-breadcrumbs">
          <button 
            onClick={() => setSelectedProjectId(null)}
            class="breadcrumb-label"
          >
            <FolderKanban size={15} color="var(--primary)" />
            <span>Projects</span>
          </button>
          
          <Show when={selectedProjectId() && currentProject()}>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-title">
              <span class="status-dot" style={{ "background-color": 'var(--secondary)' }}></span>
              {currentProject()?.name}
            </span>
          </Show>
        </div>

        {/* Center: The 3 Core Project Hub Tabs (FR-HUB-01) */}
        <Show when={selectedProjectId()}>
          <div class="segmented-control">
            <button 
              class={`seg-btn ${activeTab() === 'docs' ? 'active' : ''}`}
              onClick={() => setActiveTab('docs')}
            >
              <FileText size={13} color={activeTab() === 'docs' ? 'var(--tertiary)' : 'var(--text-dim)'} />
              <span>Docs & Plans</span>
              <Show when={docs().length > 0}>
                <span style={{ "font-size": '10px', opacity: 0.6 }}>({docs().length})</span>
              </Show>
            </button>
            <button 
              class={`seg-btn ${activeTab() === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
            >
              <LayoutGrid size={13} color={activeTab() === 'board' ? 'var(--secondary)' : 'var(--text-dim)'} />
              <span>Board</span>
              <Show when={blocks().length > 0}>
                <span style={{ "font-size": '10px', opacity: 0.6 }}>({blocks().length})</span>
              </Show>
            </button>
            <button 
              class={`seg-btn ${activeTab() === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <CheckSquare size={13} color={activeTab() === 'tasks' ? 'var(--primary)' : 'var(--text-dim)'} />
              <span>Tasks</span>
              <Show when={tasks().length > 0}>
                <span style={{ "font-size": '10px', opacity: 0.6 }}>({tasks().length})</span>
              </Show>
            </button>
          </div>
        </Show>

        {/* Right Controls */}
        <div class="header-actions">
          <button 
            onClick={loadProjects}
            title="Refresh"
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
          <button 
            onClick={props.onOpenQuickCapture}
            class="btn-pill-white"
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
                <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '6px' }}>
                  <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--text-dim)' }}>
                    Documentation
                  </span>
                  <button
                    onClick={handleCreateNewDoc}
                    title="Add new document"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      "align-items": 'center',
                      padding: '2px'
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <Show when={!loadingSubData()} fallback={
                  <div style={{ "font-size": '11px', color: 'var(--text-dim)', padding: '12px 0' }}>Loading documents...</div>
                }>
                  <Show when={docs().length > 0} fallback={
                    <div style={{ "font-size": '11px', color: 'var(--text-dim)', padding: '12px 0' }}>No documents created yet.</div>
                  }>
                    <For each={docs()}>
                      {(doc) => (
                        <div 
                          onClick={() => setSelectedDocId(doc.id)}
                          style={{
                            padding: '10px 12px',
                            "border-radius": '6px',
                            "background-color": selectedDocId() === doc.id ? 'var(--surface-container-high)' : 'transparent',
                            border: selectedDocId() === doc.id ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                            color: selectedDocId() === doc.id ? '#fff' : 'var(--text-muted)',
                            cursor: 'pointer',
                            "font-size": '12px',
                            display: 'flex',
                            "align-items": 'center',
                            gap: '8px'
                          }}
                        >
                          <FileText size={14} color={selectedDocId() === doc.id ? 'var(--tertiary)' : 'var(--text-dim)'} />
                          <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{doc.title}</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
              </aside>

              {/* Right Editorial View */}
              <main style={{ flex: 1, "overflow-y": 'auto', padding: '40px 64px', "background-color": '#111317' }}>
                <Show when={currentDoc()} fallback={
                  <div style={{ color: 'var(--text-dim)', padding: '40px 0', "text-align": 'center' }}>
                    Select or create a document to view contents.
                  </div>
                }>
                  <div style={{ "max-width": '760px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--secondary)' }}>
                      <span>DOC / {currentDoc()?.doc_type?.toUpperCase() || 'SPECIFICATION'}</span>
                    </div>

                    <h1 style={{ "font-size": '32px', "font-weight": 700, color: '#fff', "letter-spacing": '-0.02em', margin: 0 }}>
                      {currentDoc()?.title}
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
                      "Simplicity is not the absence of clutter, that's a consequence of simplicity. Simplicity essentially describes the purpose and place of an object and product."
                    </blockquote>

                    <div style={{ "font-size": '14px', "line-height": 1.7, color: 'var(--text-muted)', "white-space": 'pre-wrap' }}>
                      {currentDoc()?.content}
                    </div>

                    {/* Chromatic Palette Reference */}
                    <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px', "margin-top": '16px' }}>
                      <h3 style={{ "font-size": '13px', "font-weight": 600, color: '#fff', margin: 0 }}>Design Token Coordinates</h3>
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
                </Show>
              </main>
            </div>
          </Show>

          {/* TAB 2: BOARD (SPATIAL CANVAS) */}
          <Show when={activeTab() === 'board'}>
            <div style={{ position: 'relative', width: '100%', height: '100%', "background-color": '#111317', overflow: 'hidden' }}>
              {/* Board Title Pill */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', "z-index": 15, display: 'flex', "align-items": 'center', gap: '8px', padding: '6px 12px', "border-radius": '6px', "background-color": 'rgba(24, 26, 32, 0.85)', border: '1px solid var(--border-default)', "font-size": '11px', color: 'var(--text-muted)', "backdrop-filter": 'blur(8px)' }}>
                <span style={{ color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>CANVAS:</span>
                <span style={{ color: '#fff' }}>{boards()[0]?.title || 'Spatial Ideation Board'}</span>
              </div>

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

              {/* Dynamic Blocks Rendered from Live PostgreSQL */}
              <For each={blocks()}>
                {(block, index) => {
                  const contentObj = typeof block.content === 'object' && block.content !== null ? block.content : { title: 'Note Node', body: String(block.content || '') };
                  const isFirst = index() === 0;
                  const isSecond = index() === 1;

                  return (
                    <div
                      onMouseDown={(e) => handleMouseDown(e, block)}
                      style={{
                        position: 'absolute',
                        left: `${block.pos_x}px`,
                        top: `${block.pos_y}px`,
                        width: `${block.width || 310}px`,
                        "background-color": '#181a20',
                        border: isSecond ? '1px solid rgba(68, 225, 222, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
                        "border-radius": '6px',
                        "clip-path": block.type === 'sticky' ? 'polygon(0px 0px, calc(100% - 14px) 0px, 100% 14px, 100% 100%, 0px 100%)' : 'none',
                        padding: '16px',
                        "z-index": 20,
                        cursor: 'grab',
                        "box-shadow": '0 20px 40px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '12px' }}>
                        <span style={{
                          "font-size": '10px',
                          "font-family": 'var(--font-mono)',
                          "text-transform": 'uppercase',
                          color: isFirst ? 'var(--secondary)' : isSecond ? 'var(--primary)' : 'var(--tertiary)',
                          background: isFirst ? 'rgba(68,225,222,0.1)' : isSecond ? 'rgba(139,141,248,0.1)' : 'rgba(206,189,255,0.1)',
                          padding: '2px 6px',
                          "border-radius": '3px'
                        }}>
                          0{index() + 1} • {block.type === 'sticky' ? 'Quick Draft' : isFirst ? 'Strategy Node' : 'Connected Action'}
                        </span>
                        <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                          {block.type === 'sticky' ? 'Chamfered' : 'Synced'}
                        </span>
                      </div>

                      <h3 style={{ "font-size": '14px', "font-weight": 600, color: '#fff', margin: '0 0 8px 0' }}>
                        {contentObj.title || 'Untitled Node'}
                      </h3>

                      <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                        {contentObj.body || contentObj.text || ''}
                      </p>

                      <Show when={isSecond}>
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
                      </Show>

                      <Show when={isFirst}>
                        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": '14px', "padding-top": '10px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '11px', color: 'var(--text-dim)' }}>
                          <span>Live node: x={Math.round(block.pos_x)}, y={Math.round(block.pos_y)}</span>
                          <span style={{ color: 'var(--secondary)' }}>Active</span>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>

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
                  { key: 'todo' as const, title: 'Backlog', color: 'var(--outline-variant)' },
                  { key: 'in_progress' as const, title: 'In Progress', color: 'var(--primary)' },
                  { key: 'in_review' as const, title: 'In Review', color: 'var(--tertiary)' },
                  { key: 'done' as const, title: 'Done', color: 'var(--secondary)' }
                ].map(col => {
                  const colTasks = () => tasks().filter(t => t.status === col.key);

                  return (
                    <div style={{ padding: '12px', "border-radius": '8px', "background-color": 'var(--surface-container-low)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', "flex-direction": 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                        <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', "border-radius": '50%', "background-color": col.color }}></span>
                          <span style={{ "font-size": '12px', "font-weight": 600, color: '#fff' }}>{col.title}</span>
                        </div>
                        <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                          <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', padding: '1px 5px', "border-radius": '3px', "background-color": 'rgba(255,255,255,0.05)' }}>
                            {colTasks().length}
                          </span>
                          <button
                            onClick={() => setActiveNewTaskCol(activeNewTaskCol() === col.key ? null : col.key)}
                            title="Add task in this column"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              display: 'flex',
                              "align-items": 'center',
                              padding: '2px'
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Quick Add input */}
                      <Show when={activeNewTaskCol() === col.key}>
                        <form onSubmit={(e) => { e.preventDefault(); handleCreateTaskInCol(col.key); }}>
                          <input 
                            autofocus
                            type="text"
                            placeholder="Task name... Enter to add"
                            value={newTaskTitle()}
                            onInput={e => setNewTaskTitle(e.currentTarget.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              "font-size": '11px',
                              "background-color": 'var(--surface-container-high)',
                              border: '1px solid var(--border-default)',
                              "border-radius": '4px',
                              color: '#fff',
                              outline: 'none',
                              "box-sizing": 'border-box'
                            }}
                          />
                        </form>
                      </Show>

                      <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                        <For each={colTasks()}>
                          {(t) => (
                            <div 
                              onClick={() => handleCycleTaskStatus(t)}
                              title="Click to advance status"
                              style={{
                                padding: '12px',
                                "border-radius": '6px',
                                "background-color": 'var(--surface-container)',
                                border: '1px solid var(--border-default)',
                                display: 'flex',
                                "flex-direction": 'column',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease'
                              }}
                            >
                              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                  #{t.id.slice(-4)}
                                </span>
                                <span style={{
                                  "font-size": '9px',
                                  "font-family": 'var(--font-mono)',
                                  padding: '1px 5px',
                                  "border-radius": '3px',
                                  background: t.priority === 'urgent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)',
                                  color: t.priority === 'urgent' ? '#f87171' : 'var(--text-muted)'
                                }}>
                                  {t.priority}
                                </span>
                              </div>
                              <h4 style={{ "font-size": '12px', "font-weight": 500, color: '#fff', margin: 0 }}>
                                {t.title}
                              </h4>
                              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                                <span>{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No date'}</span>
                                <span style={{ color: col.color, display: 'flex', "align-items": 'center', gap: '2px' }}>
                                  Advance <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  );
                })}
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
              <Show when={!loadingProjects()} fallback={
                <div style={{ color: 'var(--text-dim)', padding: '24px 0' }}>Loading projects...</div>
              }>
                <For each={projects()}>
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
                            {getSpaceName(proj.space_id)}
                          </span>
                          <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', "text-transform": 'capitalize' }}>
                            {proj.status}
                          </span>
                        </div>

                        <h3 style={{ "font-size": '15px', "font-weight": 600, color: '#fff', margin: 0 }}>
                          {proj.name}
                        </h3>

                        <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                          {proj.description || 'No description provided.'}
                        </p>
                      </div>

                      <div style={{ "margin-top": '16px', "padding-top": '12px', "border-top": '1px solid rgba(255,255,255,0.05)', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span>Target: {proj.target_date ? new Date(proj.target_date).toLocaleDateString() : 'Ongoing'}</span>
                        </div>
                        <span style={{ color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>Open Hub →</span>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </main>
      </Show>

    </div>
  );
};
