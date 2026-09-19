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
  RotateCcw,
  StickyNote,
  Trash2,
  Palette,
  Maximize2
} from 'lucide-solid';
import { api } from '../services/api';
import type { Project, Space, Document as OrcaDoc, NoteBoard, NoteBlock, Task } from '../services/api';

interface ProjectsViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

interface Connection {
  fromId: string;
  toId: string;
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
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [activeCanvasTool, setActiveCanvasTool] = createSignal<'select' | 'pan' | 'card' | 'sticky' | 'text' | 'shape' | 'connector'>('select');
  const [selectedBlockId, setSelectedBlockId] = createSignal<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = createSignal<string | null>(null);
  const [connections, setConnections] = createSignal<Connection[]>([]);
  const [isSpacePressed, setIsSpacePressed] = createSignal(false);
  const [isActivelyPanning, setIsActivelyPanning] = createSignal(false);

  // Quick task input in tasks tab
  const [newTaskTitle, setNewTaskTitle] = createSignal('');
  const [activeNewTaskCol, setActiveNewTaskCol] = createSignal<string | null>(null);

  // Mouse interaction states
  let isPanningCanvas = false;
  let panStart = { x: 0, y: 0 };
  let initialPan = { x: 0, y: 0 };

  let draggingBlockState: {
    blockId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null = null;

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
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
    window.removeEventListener('keydown', handleGlobalKeyDown);
    window.removeEventListener('keyup', handleGlobalKeyUp);
  });

  // Keyboard shortcut handlers
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (['input', 'textarea'].includes(target.tagName.toLowerCase())) return;

    if (e.code === 'Space' && !isSpacePressed()) {
      setIsSpacePressed(true);
    }
    if (e.key.toLowerCase() === 'v') setActiveCanvasTool('select');
    if (e.key.toLowerCase() === 'h') setActiveCanvasTool('pan');
    if (e.key.toLowerCase() === 'c') setActiveCanvasTool(activeCanvasTool() === 'card' ? 'select' : 'card');
    if (e.key.toLowerCase() === 's') setActiveCanvasTool(activeCanvasTool() === 'sticky' ? 'select' : 'sticky');
    if (e.key.toLowerCase() === 't') setActiveCanvasTool(activeCanvasTool() === 'text' ? 'select' : 'text');
    if (e.key.toLowerCase() === 'r') setActiveCanvasTool(activeCanvasTool() === 'shape' ? 'select' : 'shape');
    if (e.key.toLowerCase() === 'l') setActiveCanvasTool(activeCanvasTool() === 'connector' ? 'select' : 'connector');
    if (e.key === 'Escape') {
      setActiveCanvasTool('select');
      setConnectingSourceId(null);
    }
  };

  const handleGlobalKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false);
      isPanningCanvas = false;
    }
  };

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
      setSelectedDocId(fetchedDocs && fetchedDocs.length > 0 ? fetchedDocs[0].id : null);

      setBoards(fetchedBoards || []);
      if (fetchedBoards && fetchedBoards.length > 0) {
        const fetchedBlocks = await api.getBoardBlocks(fetchedBoards[0].id);
        setBlocks(fetchedBlocks || []);
        if (fetchedBlocks && fetchedBlocks.length >= 2) {
          setConnections([{ fromId: fetchedBlocks[0].id, toId: fetchedBlocks[1].id }]);
        }
      } else {
        setBlocks([]);
        setConnections([]);
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

  // -------------------------------------------------------------
  // SPATIAL CANVAS INTERACTIONS (PAN, DRAG, ADD, EDIT, DELETE)
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  // UNIFIED CANVAS PAN FUNCTIONS (EXACT SAME PAN TOOL LOGIC)
  // -------------------------------------------------------------
  const startCanvasPan = (clientX: number, clientY: number) => {
    isPanningCanvas = true;
    panStart = { x: clientX, y: clientY };
    initialPan = { ...pan() };
    setIsActivelyPanning(true);
  };

  const updateCanvasPan = (clientX: number, clientY: number) => {
    if (!isPanningCanvas) return;
    const dx = clientX - panStart.x;
    const dy = clientY - panStart.y;
    setPan({
      x: initialPan.x + dx,
      y: initialPan.y + dy
    });
  };

  const stopCanvasPan = () => {
    isPanningCanvas = false;
    setIsActivelyPanning(false);
  };

  // Canvas background mouse down (Panning or Drop Block)
  const handleCanvasMouseDown = (e: MouseEvent) => {
    // If clicking on toolbar or buttons or inputs, ignore
    const target = e.target as HTMLElement;
    if (target.closest('.canvas-toolbar') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
      return;
    }

    // Right-click (2) or Middle-click (1) anywhere on canvas starts pan tool
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      startCanvasPan(e.clientX, e.clientY);
      return;
    }

    // Deselect active block if clicking on canvas
    setSelectedBlockId(null);
    setConnectingSourceId(null);

    // If a creation tool is active, place a block at clicked position with default size
    if (['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())) {
      const scale = zoom() / 100;
      const containerRect = canvasContainerRef ? canvasContainerRef.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = Math.round((e.clientX - containerRect.left - pan().x) / scale);
      const clickY = Math.round((e.clientY - containerRect.top - pan().y) / scale);
      handleCreateBlock(activeCanvasTool() as any, clickX, clickY);
      setActiveCanvasTool('select');
      return;
    }

    // Default left click on canvas background starts pan tool
    startCanvasPan(e.clientX, e.clientY);
  };

  // Block mouse down (Start Dragging or Connection)
  const handleBlockMouseDown = (e: MouseEvent, block: NoteBlock) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (['button', 'input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) {
      return;
    }

    // If a creation tool is active, place the new object right where clicked
    if (['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())) {
      const scale = zoom() / 100;
      const containerRect = canvasContainerRef?.getBoundingClientRect();
      if (containerRect) {
        const clickX = Math.round((e.clientX - containerRect.left - pan().x) / scale);
        const clickY = Math.round((e.clientY - containerRect.top - pan().y) / scale);
        handleCreateBlock(activeCanvasTool() as any, clickX, clickY);
        setActiveCanvasTool('select');
      }
      return;
    }

    // Connector tool mode: clicking block links it
    if (activeCanvasTool() === 'connector') {
      if (!connectingSourceId()) {
        setConnectingSourceId(block.id);
      } else if (connectingSourceId() !== block.id) {
        setConnections([...connections(), { fromId: connectingSourceId()!, toId: block.id }]);
        setConnectingSourceId(null);
        setActiveCanvasTool('select');
      }
      return;
    }

    setSelectedBlockId(block.id);

    // Dragging
    draggingBlockState = {
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: block.pos_x,
      initialY: block.pos_y
    };
  };

  // Global mouse move for Dragging & Panning
  const handleGlobalMouseMove = (e: MouseEvent) => {
    // 1. Panning canvas (Exact Pan Tool logic)
    if (isPanningCanvas) {
      updateCanvasPan(e.clientX, e.clientY);
      return;
    }

    // 2. Dragging block
    if (draggingBlockState) {
      const scale = zoom() / 100;
      const { blockId, startX, startY, initialX, initialY } = draggingBlockState;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;

      setBlocks(blocks().map(b => {
        if (b.id === blockId) {
          return {
            ...b,
            pos_x: Math.round(initialX + dx),
            pos_y: Math.round(initialY + dy)
          };
        }
        return b;
      }));
    }
  };

  // Global mouse up
  const handleGlobalMouseUp = async () => {
    stopCanvasPan();

    if (!draggingBlockState) return;
    const blockId = draggingBlockState.blockId;
    draggingBlockState = null;

    const block = blocks().find(b => b.id === blockId);
    if (block) {
      try {
        await api.updateNoteBlock(block.id, {
          pos_x: block.pos_x,
          pos_y: block.pos_y
        });
      } catch (err) {
        console.error('Failed to persist block position:', err);
      }
    }
  };

  // -------------------------------------------------------------
  // TWO-FINGER SCROLL & TOUCH GESTURES (USING PAN TOOL LOGIC)
  // -------------------------------------------------------------
  let canvasContainerRef: HTMLDivElement | undefined;

  // Trackpad 2-finger scroll and wheel zoom
  const handleCanvasWheel = (e: WheelEvent) => {
    // If inside an editable textarea/input that has its own scroll, preserve it
    const target = e.target as HTMLElement;
    if (target && (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'input')) {
      if (target.scrollHeight > target.clientHeight) {
        return;
      }
    }

    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom on trackpad or Ctrl + MouseWheel
      const zoomFactor = -e.deltaY * 0.01;
      const currentZoom = zoom();
      const newZoom = Math.min(250, Math.max(25, Math.round(currentZoom * (1 + zoomFactor))));

      if (canvasContainerRef) {
        const rect = canvasContainerRef.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const scaleOld = currentZoom / 100;
        const scaleNew = newZoom / 100;

        const worldX = (cursorX - pan().x) / scaleOld;
        const worldY = (cursorY - pan().y) / scaleOld;

        setPan({
          x: Math.round(cursorX - worldX * scaleNew),
          y: Math.round(cursorY - worldY * scaleNew)
        });
      }
      setZoom(newZoom);
    } else {
      // Direct pan delta: exactly -e.deltaX and -e.deltaY in any direction
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Touchscreen 2-finger gestures (Pan Tool logic)
  const handleCanvasTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      startCanvasPan(midX, midY);
      e.preventDefault();
    }
  };

  const handleCanvasTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && isPanningCanvas) {
      e.preventDefault();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      updateCanvasPan(midX, midY);
    }
  };

  const handleCanvasTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      stopCanvasPan();
    }
  };

  // Create a new block at coordinates or viewport center
  const handleCreateBlock = async (type: NoteBlock['type'] = 'card', posX?: number, posY?: number) => {
    const board = boards()[0];
    if (!board) {
      console.warn('No active board found to attach block.');
      return;
    }

    const scale = zoom() / 100;
    // If coordinates not provided, drop at visible canvas center
    const x = posX !== undefined ? posX : Math.round((-pan().x + 360) / scale + (blocks().length * 20) % 100);
    const y = posY !== undefined ? posY : Math.round((-pan().y + 180) / scale + (blocks().length * 20) % 100);

    const defaultContent = {
      card: { title: 'New Strategy Note', body: 'Detail architectural requirements, tokens, or execution ideas here.' },
      sticky: { title: 'Quick Idea', body: 'Draft sprint thoughts or tactile considerations.', color: '#44e1de' },
      text: { title: 'Section Header', body: 'Type free-floating label' },
      shape: { title: 'Group Container', body: 'Drag cards inside this boundary.' },
      image: { title: 'Image Reference', body: '' },
      task_embed: { title: 'Embedded Sprint Task', body: '' }
    };

    const width = type === 'text' ? 240 : type === 'shape' ? 440 : 310;
    const height = type === 'shape' ? 280 : undefined;

    try {
      const created = await api.createNoteBlock(board.id, {
        type,
        pos_x: x,
        pos_y: y,
        width,
        height,
        content: defaultContent[type] || { title: 'New Node', body: '' }
      });

      setBlocks([...blocks(), created]);
      setSelectedBlockId(created.id);
    } catch (err) {
      console.error('Failed to create block:', err);
    }
  };

  // Inline update of block title or body
  const handleUpdateBlockContent = async (block: NoteBlock, key: 'title' | 'body' | 'color', val: string) => {
    const prevContent = typeof block.content === 'object' && block.content !== null ? block.content : {};
    const updatedContent = { ...prevContent, [key]: val };

    // Update local state immediately
    setBlocks(blocks().map(b => b.id === block.id ? { ...b, content: updatedContent } : b));

    // Save to database
    try {
      await api.updateNoteBlock(block.id, { content: updatedContent });
    } catch (err) {
      console.error('Failed to save block content:', err);
    }
  };

  // Change block type (card, sticky, text, shape)
  const handleChangeBlockType = async (block: NoteBlock, newType: NoteBlock['type']) => {
    setBlocks(blocks().map(b => b.id === block.id ? { ...b, type: newType } : b));
    try {
      await api.updateNoteBlock(block.id, { type: newType });
    } catch (err) {
      console.error('Failed to update block type:', err);
    }
  };

  // Delete a block from canvas and database
  const handleDeleteBlock = async (blockId: string) => {
    setBlocks(blocks().filter(b => b.id !== blockId));
    setConnections(connections().filter(c => c.fromId !== blockId && c.toId !== blockId));
    if (selectedBlockId() === blockId) setSelectedBlockId(null);

    try {
      await api.deleteNoteBlock(blockId);
    } catch (err) {
      console.error('Failed to delete block:', err);
    }
  };

  // Render SVG Bézier curves for all active connections
  const renderConnectorCurves = () => {
    const blist = blocks();
    return connections().map(conn => {
      const b1 = blist.find(b => b.id === conn.fromId);
      const b2 = blist.find(b => b.id === conn.toId);
      if (!b1 || !b2) return null;

      const p1X = b1.pos_x + (b1.width || 310);
      const p1Y = b1.pos_y + 90;
      const p2X = b2.pos_x;
      const p2Y = b2.pos_y + 90;
      const deltaX = Math.max(40, (p2X - p1X) * 0.5);
      const pathData = `M ${p1X} ${p1Y} C ${p1X + deltaX} ${p1Y}, ${p2X - deltaX} ${p2Y}, ${p2X} ${p2Y}`;

      return (
        <path 
          d={pathData} 
          fill="none" 
          stroke="var(--secondary)" 
          stroke-width="2" 
          stroke-dasharray="4 4"
          opacity="0.8"
        />
      );
    });
  };

  // -------------------------------------------------------------
  // TASKS & DOCS TAB HANDLERS
  // -------------------------------------------------------------

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
      
      {/* Project Hub Top Header */}
      <header class="orca-header">
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

        {/* Center: The 3 Core Project Hub Tabs */}
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

        {/* Right Header Actions */}
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
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          
          {/* =========================================================
             TAB 1: DOCS & PLANS
             ========================================================= */}
          <Show when={activeTab() === 'docs'}>
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
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
                  </div>
                </Show>
              </main>
            </div>
          </Show>

          {/* =========================================================
             TAB 2: BOARD (MILANOTE SPATIAL CANVAS ENGINE)
             ========================================================= */}
          <Show when={activeTab() === 'board'}>
            <div 
              ref={(el) => {
                canvasContainerRef = el;
                el.addEventListener('wheel', handleCanvasWheel, { passive: false });
                el.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });
                el.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
                el.addEventListener('touchend', handleCanvasTouchEnd);
                el.addEventListener('touchcancel', handleCanvasTouchEnd);

                onCleanup(() => {
                  el.removeEventListener('wheel', handleCanvasWheel);
                  el.removeEventListener('touchstart', handleCanvasTouchStart);
                  el.removeEventListener('touchmove', handleCanvasTouchMove);
                  el.removeEventListener('touchend', handleCanvasTouchEnd);
                  el.removeEventListener('touchcancel', handleCanvasTouchEnd);
                });
              }}
              onMouseDown={handleCanvasMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                "background-color": '#111317',
                overflow: 'hidden',
                "touch-action": 'none',
                cursor: isActivelyPanning() 
                  ? 'grabbing' 
                  : ['card', 'sticky', 'text', 'shape', 'connector'].includes(activeCanvasTool())
                  ? 'crosshair'
                  : (activeCanvasTool() === 'pan' || isSpacePressed() ? 'grab' : 'default')
              }}
            >
              {/* Board Header Info */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', "z-index": 15, display: 'flex', "align-items": 'center', gap: '8px', padding: '6px 12px', "border-radius": '6px', "background-color": 'rgba(24, 26, 32, 0.85)', border: '1px solid var(--border-default)', "font-size": '11px', color: 'var(--text-muted)', "backdrop-filter": 'blur(8px)' }}>
                <span style={{ color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>CANVAS:</span>
                <span style={{ color: '#fff' }}>{boards()[0]?.title || 'Spatial Ideation Board'}</span>
                <span style={{ color: 'var(--text-dim)', "font-size": '10px' }}>({blocks().length} nodes)</span>
              </div>

              {/* Dynamic Dot Grid Background moves with pan */}
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  "background-image": 'radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
                  "background-size": '24px 24px',
                  "background-position": `${pan().x}px ${pan().y}px`,
                  "pointer-events": 'none'
                }}
              />

              {/* Scalable & Pannable Content Layer */}
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom() / 100})`,
                  "transform-origin": '0 0',
                  "pointer-events": 'auto'
                }}
              >
                {/* Dynamic SVG Connector Curves */}
                <svg style={{ position: 'absolute', inset: 0, width: '4000px', height: '4000px', "pointer-events": 'none', "z-index": 10 }}>
                  {renderConnectorCurves()}
                </svg>

                {/* Dynamic Blocks */}
                <For each={blocks()}>
                  {(block, index) => {
                    const contentObj = () => typeof block.content === 'object' && block.content !== null 
                      ? block.content 
                      : { title: 'Note Node', body: String(block.content || '') };
                    
                    const isSelected = () => selectedBlockId() === block.id;
                    const isConnectingSource = () => connectingSourceId() === block.id;

                    const blockTypeClass = () => {
                      switch (block.type) {
                        case 'sticky': return 'canvas-block-sticky';
                        case 'text': return 'canvas-block-text';
                        case 'shape': return 'canvas-block-shape';
                        default: return 'canvas-block-card';
                      }
                    };

                    return (
                      <div
                        onMouseDown={(e) => handleBlockMouseDown(e, block)}
                        class={`canvas-block ${blockTypeClass()} ${isSelected() ? 'selected' : ''}`}
                        style={{
                          left: `${block.pos_x}px`,
                          top: `${block.pos_y}px`,
                          width: `${block.width || 310}px`,
                          height: block.height ? `${block.height}px` : 'auto',
                          outline: isConnectingSource() ? '2px dashed var(--secondary)' : undefined
                        }}
                      >
                        {/* Header bar with tag, type and action controls */}
                        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '8px' }}>
                          <span style={{
                            "font-size": '10px',
                            "font-family": 'var(--font-mono)',
                            "text-transform": 'uppercase',
                            color: block.type === 'sticky' ? 'var(--tertiary)' : 'var(--secondary)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 6px',
                            "border-radius": '3px'
                          }}>
                            0{index() + 1} • {block.type}
                          </span>

                          <div class="block-header-actions">
                            {/* Cycle type */}
                            <button
                              class="block-action-btn"
                              title="Toggle Card / Sticky / Text"
                              onClick={(e) => {
                                e.stopPropagation();
                                const types: NoteBlock['type'][] = ['card', 'sticky', 'text', 'shape'];
                                const next = types[(types.indexOf(block.type) + 1) % types.length];
                                handleChangeBlockType(block, next);
                              }}
                            >
                              <Palette size={12} />
                            </button>

                            {/* Connect button */}
                            <button
                              class="block-action-btn"
                              title="Connect to another card"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConnectingSourceId(block.id);
                                setActiveCanvasTool('connector');
                              }}
                            >
                              <Share2 size={12} color={isConnectingSource() ? 'var(--secondary)' : undefined} />
                            </button>

                            {/* Delete block */}
                            <button
                              class="block-action-btn btn-delete"
                              title="Delete block"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBlock(block.id);
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Inline Editable Title */}
                        <input
                          type="text"
                          class="block-input-title"
                          value={contentObj().title || ''}
                          onInput={(e) => handleUpdateBlockContent(block, 'title', e.currentTarget.value)}
                          placeholder="Node Title..."
                          onMouseDown={(e) => e.stopPropagation()}
                        />

                        {/* Inline Editable Body */}
                        <textarea
                          rows={block.type === 'text' ? 1 : 3}
                          class="block-textarea-body"
                          value={contentObj().body || ''}
                          onInput={(e) => handleUpdateBlockContent(block, 'body', e.currentTarget.value)}
                          placeholder="Type notes, strategy coordinates, or markdown..."
                          onMouseDown={(e) => e.stopPropagation()}
                        />

                        {/* Quick Navigation Footer */}
                        <Show when={block.type === 'card'}>
                          <div style={{ display: 'flex', gap: '6px', "margin-top": '10px', "padding-top": '8px', "border-top": '1px solid rgba(255,255,255,0.06)' }}>
                            <button 
                              onClick={() => setActiveTab('docs')}
                              style={{ flex: 1, padding: '4px 6px', "background-color": 'var(--surface-container-high)', border: '1px solid var(--border-default)', "border-radius": '4px', color: '#fff', "font-size": '10px', cursor: 'pointer', display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '4px' }}
                            >
                              <FileText size={11} />
                              <span>Doc</span>
                            </button>
                            <button 
                              onClick={() => setActiveTab('tasks')}
                              style={{ flex: 1, padding: '4px 6px', "background-color": 'rgba(68,225,222,0.1)', border: '1px solid rgba(68,225,222,0.3)', "border-radius": '4px', color: 'var(--secondary)', "font-size": '10px', cursor: 'pointer', display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '4px' }}
                            >
                              <CheckSquare size={11} />
                              <span>Task</span>
                            </button>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>

              {/* =========================================================
                 FLOATING OBSIDIAN GLASS CANVAS TOOLBAR
                 ========================================================= */}
              <div class="canvas-toolbar">
                {/* Pointer / Select */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'select' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('select')}
                  title="Select & Move (V)"
                >
                  <MousePointer size={15} />
                </button>

                {/* Pan Tool */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'pan' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('pan')}
                  title="Hand / Pan Canvas (H or Hold Space)"
                >
                  <Hand size={15} />
                </button>

                <div class="tool-divider"></div>

                {/* Add Card */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'card' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'card' ? 'select' : 'card')}
                  title="Add Strategy Card (C) - Click tool then click canvas to place"
                >
                  <LayoutGrid size={15} />
                </button>

                {/* Add Sticky Note */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'sticky' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'sticky' ? 'select' : 'sticky')}
                  title="Add Sticky Note (S) - Click tool then click canvas to place"
                >
                  <StickyNote size={15} />
                </button>

                {/* Add Text Block */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'text' ? 'select' : 'text')}
                  title="Add Text Block (T) - Click tool then click canvas to place"
                >
                  <Type size={15} />
                </button>

                {/* Add Shape Container */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'shape' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'shape' ? 'select' : 'shape')}
                  title="Add Shape Frame (R) - Click tool then click canvas to place"
                >
                  <Square size={15} />
                </button>

                {/* Connector Tool */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'connector' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCanvasTool(activeCanvasTool() === 'connector' ? 'select' : 'connector');
                    setConnectingSourceId(null);
                  }}
                  title="Connector Curve (L)"
                >
                  <Share2 size={15} />
                </button>

                <div class="tool-divider"></div>

                {/* Zoom Controls */}
                <div style={{ display: 'flex', "align-items": 'center', gap: '2px', "font-size": '11px', "font-family": 'var(--font-mono)' }}>
                  <button 
                    onClick={() => setZoom(z => Math.max(50, z - 10))} 
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <span 
                    onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); }}
                    title="Click to reset zoom & pan"
                    style={{ padding: '0 6px', color: 'var(--text-muted)', cursor: 'pointer', "user-select": 'none' }}
                  >
                    {zoom()}%
                  </span>
                  <button 
                    onClick={() => setZoom(z => Math.min(150, z + 10))} 
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button 
                    onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); }}
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                    title="Reset to 100%"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </Show>

          {/* =========================================================
             TAB 3: TASKS (PROJECT KANBAN)
             ========================================================= */}
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
        {/* =========================================================
           PROJECT DIRECTORY VIEW (When no project is opened)
           ========================================================= */}
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
