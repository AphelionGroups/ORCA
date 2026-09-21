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
  Circle,
  Diamond,
  Triangle,
  Hexagon,
  Share2, 
  Type,
  ChevronRight,
  RotateCcw,
  StickyNote,
  Maximize2,
  Undo,
  Redo
} from 'lucide-solid';
import { api } from '../services/api';
import type { Project, Space, Document as OrcaDoc, NoteBoard, NoteBlock, Task } from '../services/api';

interface ProjectsViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

export type ShapeKind = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hexagon';

const SHAPE_OPTIONS: { id: ShapeKind; label: string; icon: Component<{ size?: number; class?: string }> }[] = [
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'diamond', label: 'Diamond', icon: Diamond },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
  { id: 'hexagon', label: 'Hexagon', icon: Hexagon },
];

const DynamicShapeIcon: Component<{ kind: ShapeKind; size?: number; class?: string }> = (props) => {
  switch (props.kind) {
    case 'circle': return <Circle size={props.size || 15} class={props.class} />;
    case 'diamond': return <Diamond size={props.size || 15} class={props.class} />;
    case 'triangle': return <Triangle size={props.size || 15} class={props.class} />;
    case 'hexagon': return <Hexagon size={props.size || 15} class={props.class} />;
    default: return <Square size={props.size || 15} class={props.class} />;
  }
};

interface Connection {
  fromId: string;
  toId: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
}

type CanvasAction =
  | {
      type: 'create_block';
      block: NoteBlock;
    }
  | {
      type: 'delete_blocks';
      blocks: NoteBlock[];
      connections: Connection[];
    }
  | {
      type: 'move_blocks';
      moves: Array<{ id: string; fromX: number; fromY: number; toX: number; toY: number }>;
    }
  | {
      type: 'update_text';
      blockId: string;
      prevContent: any;
      newContent: any;
    }
  | {
      type: 'create_connection';
      connection: Connection;
    }
  | {
      type: 'delete_connection';
      connection: Connection;
    }
  | {
      type: 'resize_block';
      blockId: string;
      prevX: number;
      prevY: number;
      prevWidth: number;
      prevHeight?: number;
      newX: number;
      newY: number;
      newWidth: number;
      newHeight?: number;
    };

// -------------------------------------------------------------
// UNIFIED LIVE MARKDOWN PARSER & SEAMLESS DOCUMENT BLOCK
// -------------------------------------------------------------
function formatInlineMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#fff;">$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style:italic;color:var(--secondary);">$1</em>');
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code class="inline-code-badge">$1</code>');
  // Strikethrough ~~text~~
  html = html.replace(/~~(.*?)~~/g, '<del style="opacity:0.6;">$1</del>');
  return html;
}

function renderFullMarkdown(raw: string): string {
  if (!raw || !raw.trim()) return '';

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      result.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      result.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      result.push('<div class="md-empty-spacer"></div>');
      continue;
    }

    if (line.startsWith('# ')) {
      closeLists();
      result.push(`<div class="md-render-h1">${formatInlineMarkdown(line.slice(2))}</div>`);
    } else if (line.startsWith('## ')) {
      closeLists();
      result.push(`<div class="md-render-h2">${formatInlineMarkdown(line.slice(3))}</div>`);
    } else if (line.startsWith('### ')) {
      closeLists();
      result.push(`<div class="md-render-h3">${formatInlineMarkdown(line.slice(4))}</div>`);
    } else if (line.startsWith('> ')) {
      closeLists();
      result.push(`<div class="md-render-quote">${formatInlineMarkdown(line.slice(2))}</div>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        result.push('<ul class="md-render-ul">');
        inUl = true;
      }
      result.push(`<li class="md-render-li">${formatInlineMarkdown(line.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        result.push('<ol class="md-render-ol">');
        inOl = true;
      }
      result.push(`<li class="md-render-li">${formatInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else {
      closeLists();
      result.push(`<div class="md-render-p">${formatInlineMarkdown(line)}</div>`);
    }
  }

  closeLists();
  return result.join('');
}

interface UnifiedMarkdownBlockProps {
  block: NoteBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onFinishEdit: (finalText?: string) => void;
}

const UnifiedMarkdownBlock: Component<UnifiedMarkdownBlockProps> = (props) => {
  const getRaw = () => {
    const c = props.block.content;
    if (!c) return '';
    if (typeof c === 'string') return c;
    if (typeof c === 'object') {
      if (typeof c.text === 'string') return c.text;
      const parts = [c.title, c.body].filter(Boolean);
      return parts.join('\n\n');
    }
    return '';
  };

  const [text, setText] = createSignal<string>(getRaw());

  // Keep local text in sync when not actively editing
  createEffect(() => {
    if (!props.isEditing) {
      setText(getRaw());
    }
  });

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const minH = props.block.type === 'shape' || props.block.type === 'text' ? 24 : 50;
    el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
  };

  const placeholderText = () => {
    switch (props.block.type) {
      case 'shape': return 'Double-click to type...';
      case 'text': return 'Double-click to type text...';
      case 'sticky': return 'Double-click to write note...';
      default: return 'Double-click to write (# heading, - list)...';
    }
  };

  return (
    <div 
      class="canvas-block-content"
      onDblClick={(e) => {
        e.stopPropagation();
        if (!props.isEditing) {
          props.onStartEdit();
        }
      }}
    >
      <Show
        when={props.isEditing}
        fallback={
          <Show
            when={text().trim().length > 0}
            fallback={
              <div class="canvas-block-placeholder">
                {placeholderText()}
              </div>
            }
          >
            <div 
              class="canvas-block-formatted"
              innerHTML={renderFullMarkdown(text())}
            />
          </Show>
        }
      >
        <textarea
          ref={(el) => {
            if (el) {
              setTimeout(() => {
                el.focus();
                autoResizeTextarea(el);
                el.setSelectionRange(el.value.length, el.value.length);
              }, 10);
            }
          }}
          class="canvas-block-unified-editor"
          value={text()}
          onMouseDown={(e) => e.stopPropagation()}
          onInput={(e) => {
            const val = e.currentTarget.value;
            setText(val);
            autoResizeTextarea(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              props.onFinishEdit(e.currentTarget.value);
            }
          }}
          onBlur={(e) => props.onFinishEdit(e.currentTarget.value)}
          placeholder={placeholderText()}
        />
      </Show>
    </div>
  );
};

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
  const [selectedShapeKind, setSelectedShapeKind] = createSignal<ShapeKind>(
    (localStorage.getItem('orca_last_shape_kind') as ShapeKind) || 'rectangle'
  );
  const [showShapePicker, setShowShapePicker] = createSignal(false);
  const [selectedBlockId, setSelectedBlockId] = createSignal<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = createSignal<string[]>([]);
  const [editingBlockId, setEditingBlockId] = createSignal<string | null>(null);
  const [showContextColorPicker, setShowContextColorPicker] = createSignal(false);
  const [showContextMoreMenu, setShowContextMoreMenu] = createSignal(false);
  const [copiedBlock, setCopiedBlock] = createSignal<NoteBlock | null>(null);

  const primarySelectedBlock = () => {
    const id = selectedBlockId() || (selectedBlockIds().length > 0 ? selectedBlockIds()[0] : null);
    if (!id) return null;
    return blocks().find(b => b.id === id) || null;
  };
  const [selectionBox, setSelectionBox] = createSignal<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [connectingSourceId, setConnectingSourceId] = createSignal<string | null>(null);
  const [connections, setConnections] = createSignal<Connection[]>([]);
  const [isSpacePressed, setIsSpacePressed] = createSignal(false);
  const [isActivelyPanning, setIsActivelyPanning] = createSignal(false);
  const [cursorCanvasPos, setCursorCanvasPos] = createSignal<{ x: number, y: number } | null>(null);

  // Canvas Undo & Redo History Stacks
  const [undoStack, setUndoStack] = createSignal<CanvasAction[]>([]);
  const [redoStack, setRedoStack] = createSignal<CanvasAction[]>([]);

  const pushUndoAction = (action: CanvasAction) => {
    setUndoStack(prev => [...prev.slice(-49), action]);
    setRedoStack([]);
  };

  // Quick task input in tasks tab
  const [newTaskTitle, setNewTaskTitle] = createSignal('');
  const [activeNewTaskCol, setActiveNewTaskCol] = createSignal<string | null>(null);

  // Mouse interaction states
  let isPanningCanvas = false;
  let panStart = { x: 0, y: 0 };
  let initialPan = { x: 0, y: 0 };

  let isSelectingArea = false;
  let selectionStartWorld = { x: 0, y: 0 };

  let draggingBlockState: {
    blockId: string;
    startX: number;
    startY: number;
    initialPositions: { id: string; x: number; y: number }[];
  } | null = null;

  // Block resize drag state
  let resizingBlockState: {
    blockId: string;
    corner: 'nw' | 'ne' | 'se' | 'sw';
    startClientX: number;
    startClientY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  } | null = null;

  // Connection handle drag state
  let draggingHandle: {
    blockId: string;
    side: 'top' | 'right' | 'bottom' | 'left';
    startClientX: number;
    startClientY: number;
    didDrag: boolean;
  } | null = null;

  const [dragArrowStart, setDragArrowStart] = createSignal<{ x: number; y: number } | null>(null);
  const [dragArrowEnd, setDragArrowEnd] = createSignal<{ x: number; y: number } | null>(null);
  const [hoveredTargetBlockId, setHoveredTargetBlockId] = createSignal<string | null>(null);
  const [hoveredTargetSide, setHoveredTargetSide] = createSignal<'top' | 'right' | 'bottom' | 'left' | null>(null);
  const [selectedConnection, setSelectedConnection] = createSignal<Connection | null>(null);
  const [blockDomHeights, setBlockDomHeights] = createSignal<Record<string, number>>({});

  const getBlockWidth = (b: NoteBlock): number => {
    if (b.width && b.width > 0) return b.width;
    if (b.type === 'text') return 240;
    if (b.type === 'shape') {
      const kind = (b.content?.shape_kind as ShapeKind) || 'rectangle';
      switch (kind) {
        case 'circle': return 140;
        case 'diamond': return 160;
        case 'triangle': return 160;
        case 'hexagon': return 170;
        default: return 180;
      }
    }
    return 310;
  };

  const getBlockHeight = (b: NoteBlock): number => {
    if (b.height && b.height > 0) return b.height;
    const measured = blockDomHeights()[b.id];
    if (measured && measured > 0) return measured;
    if (b.type === 'shape') {
      const kind = (b.content?.shape_kind as ShapeKind) || 'rectangle';
      switch (kind) {
        case 'circle': return 100;
        case 'diamond': return 110;
        case 'triangle': return 120;
        case 'hexagon': return 85;
        default: return 70;
      }
    }
    return b.type === 'text' ? 36 : 70;
  };

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

  const handleWindowClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (showShapePicker() && !target?.closest('.shape-tool-wrapper')) {
      setShowShapePicker(false);
    }
    if (showContextColorPicker() && !target?.closest('.canvas-context-toolbar')) {
      setShowContextColorPicker(false);
    }
    if (showContextMoreMenu() && !target?.closest('.canvas-context-toolbar')) {
      setShowContextMoreMenu(false);
    }
  };

  onMount(() => {
    loadProjects();
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    window.addEventListener('click', handleWindowClick);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
    window.removeEventListener('keydown', handleGlobalKeyDown);
    window.removeEventListener('keyup', handleGlobalKeyUp);
    window.removeEventListener('click', handleWindowClick);
  });

  // Keyboard shortcut handlers
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (['input', 'textarea'].includes(target.tagName.toLowerCase())) return;

    // Shortcuts with Ctrl / Cmd
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key.toLowerCase() === 'd') {
        const b = primarySelectedBlock();
        if (b) {
          e.preventDefault();
          handleDuplicateBlock(b);
        }
        return;
      }
      if (e.key.toLowerCase() === 'c') {
        const b = primarySelectedBlock();
        if (b) {
          handleCopyBlock(b);
        }
        return;
      }
      if (e.key.toLowerCase() === 'x') {
        const b = primarySelectedBlock();
        if (b) {
          e.preventDefault();
          handleCutBlock(b);
        }
        return;
      }
      if (e.key.toLowerCase() === 'v') {
        if (copiedBlock()) {
          e.preventDefault();
          handlePasteBlock();
        }
        return;
      }
    }

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
      setShowContextColorPicker(false);
      setShowContextMoreMenu(false);
      setShowShapePicker(false);
      setActiveCanvasTool('select');
      setConnectingSourceId(null);
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectedConnection(null);
      setSelectionBox(null);
      isSelectingArea = false;
      setEditingBlockId(null);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedBlockIds().length > 0 || selectedBlockId()) {
        e.preventDefault();
        const idsToDelete = selectedBlockIds().length > 0 ? [...selectedBlockIds()] : [selectedBlockId()!];
        handleDeleteBlocks(idsToDelete);
      } else if (selectedConnection()) {
        e.preventDefault();
        handleDeleteConnection(selectedConnection()!);
      }
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
          const connectable = fetchedBlocks.filter(b => b.type !== 'sticky');
          if (connectable.length >= 2) {
            setConnections([{ fromId: connectable[0].id, toId: connectable[1].id }]);
          } else {
            setConnections([]);
          }
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

    // Right-click: if in placement mode, cancel tool back to 'select'; otherwise start pan tool
    if (e.button === 2) {
      e.preventDefault();
      if (['card', 'sticky', 'text', 'shape', 'connector'].includes(activeCanvasTool())) {
        setActiveCanvasTool('select');
        setCursorCanvasPos(null);
        return;
      }
      startCanvasPan(e.clientX, e.clientY);
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      startCanvasPan(e.clientX, e.clientY);
      return;
    }

    // Deselect active block if clicking on canvas
    if (!e.shiftKey) {
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
    }
    setSelectedConnection(null);
    setConnectingSourceId(null);
    if (editingBlockId()) setEditingBlockId(null);

    // If a creation tool is active, place a block at clicked position with default size
    if (['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())) {
      const scale = zoom() / 100;
      const containerRect = canvasContainerRef ? canvasContainerRef.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = Math.round((e.clientX - containerRect.left - pan().x) / scale);
      const clickY = Math.round((e.clientY - containerRect.top - pan().y) / scale);
      handleCreateBlock(activeCanvasTool() as any, clickX, clickY);
      setActiveCanvasTool('select');
      setCursorCanvasPos(null);
      return;
    }

    // If pan tool is active OR space is pressed: pan canvas
    if (activeCanvasTool() === 'pan' || isSpacePressed()) {
      startCanvasPan(e.clientX, e.clientY);
      return;
    }

    // Default left click in Select mode: Start Multi-Select Area Marquee!
    const scale = zoom() / 100;
    const containerRect = canvasContainerRef ? canvasContainerRef.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();
    const worldX = Math.round((e.clientX - containerRect.left - pan().x) / scale);
    const worldY = Math.round((e.clientY - containerRect.top - pan().y) / scale);

    isSelectingArea = true;
    selectionStartWorld = { x: worldX, y: worldY };
    setSelectionBox({
      x: worldX,
      y: worldY,
      width: 0,
      height: 0
    });
  };

  // Block mouse down (Start Dragging or Connection)
  const handleBlockMouseDown = (e: MouseEvent, block: NoteBlock) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (['button', 'input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) {
      return;
    }
    if (editingBlockId() && editingBlockId() !== block.id) {
      setEditingBlockId(null);
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
        setCursorCanvasPos(null);
      }
      return;
    }

    // Connector tool mode: clicking block links it (notes cannot refer or be referred)
    if (activeCanvasTool() === 'connector') {
      if (block.type === 'sticky') return;
      if (!connectingSourceId()) {
        setConnectingSourceId(block.id);
      } else if (connectingSourceId() !== block.id) {
        const newConn = { fromId: connectingSourceId()!, toId: block.id };
        setConnections([...connections(), newConn]);
        pushUndoAction({ type: 'create_connection', connection: newConn });
        setConnectingSourceId(null);
        setActiveCanvasTool('select');
      }
      return;
    }

    // Multi-selection handling on block click
    let currentSelected = selectedBlockIds();
    if (e.shiftKey) {
      if (currentSelected.includes(block.id)) {
        currentSelected = currentSelected.filter(id => id !== block.id);
      } else {
        currentSelected = [...currentSelected, block.id];
      }
    } else {
      if (!currentSelected.includes(block.id)) {
        currentSelected = [block.id];
      }
    }
    setSelectedBlockIds(currentSelected);
    setSelectedBlockId(currentSelected.length > 0 ? block.id : null);

    // If block is locked, allow selection (to show toolbar & unlock) but do not drag
    if (block.content?.locked) {
      return;
    }

    // Prepare dragging for all currently selected blocks
    const blocksToDrag = blocks().filter(b => currentSelected.includes(b.id));
    draggingBlockState = {
      blockId: block.id,
      startX: e.clientX,
      startY: e.clientY,
      initialPositions: blocksToDrag.map(b => ({
        id: b.id,
        x: b.pos_x,
        y: b.pos_y
      }))
    };
  };

  // Helper: get canvas-space center point of a side on a block
  const getSidePoint = (block: NoteBlock, side: 'top' | 'right' | 'bottom' | 'left'): { x: number; y: number; side: 'top' | 'right' | 'bottom' | 'left' } => {
    const w = getBlockWidth(block);
    const h = getBlockHeight(block);
    switch (side) {
      case 'top':    return { x: block.pos_x + w / 2, y: block.pos_y, side };
      case 'right':  return { x: block.pos_x + w,     y: block.pos_y + h / 2, side };
      case 'bottom': return { x: block.pos_x + w / 2, y: block.pos_y + h, side };
      case 'left':   return { x: block.pos_x,          y: block.pos_y + h / 2, side };
    }
  };

  const getClosestSide = (block: NoteBlock, canvasX: number, canvasY: number): 'top' | 'right' | 'bottom' | 'left' => {
    const w = getBlockWidth(block);
    const h = getBlockHeight(block);
    const cx = block.pos_x + w / 2;
    const cy = block.pos_y + h / 2;
    const dx = canvasX - cx;
    const dy = canvasY - cy;
    const nx = dx / (w / 2 || 1);
    const ny = dy / (h / 2 || 1);
    if (Math.abs(nx) >= Math.abs(ny)) {
      return nx > 0 ? 'right' : 'left';
    } else {
      return ny > 0 ? 'bottom' : 'top';
    }
  };

  // Helper: get canvas-space center point of a handle side on a block
  const getHandleCanvasPos = (block: NoteBlock, side: 'top' | 'right' | 'bottom' | 'left') => {
    return getSidePoint(block, side);
  };

  // Mouse down on a connection handle
  const handleHandleMouseDown = (e: MouseEvent, block: NoteBlock, side: 'top' | 'right' | 'bottom' | 'left') => {
    e.stopPropagation();
    e.preventDefault();
    draggingHandle = {
      blockId: block.id,
      side,
      startClientX: e.clientX,
      startClientY: e.clientY,
      didDrag: false,
    };
    setSelectedConnection(null);
    const startCanvas = getHandleCanvasPos(block, side);
    setDragArrowStart(startCanvas);
    setDragArrowEnd(startCanvas);
  };

  // Mouse down on a block corner resize handle
  const handleResizeMouseDown = (e: MouseEvent, block: NoteBlock, corner: 'nw' | 'ne' | 'se' | 'sw') => {
    e.stopPropagation();
    e.preventDefault();
    if (block.content?.locked) return;
    const w = getBlockWidth(block);
    const h = getBlockHeight(block);
    resizingBlockState = {
      blockId: block.id,
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: block.pos_x,
      initialY: block.pos_y,
      initialWidth: w,
      initialHeight: h,
    };
  };

  // Double click on resize handle resets height to auto
  const handleResetBlockDimensions = async (e: MouseEvent, block: NoteBlock) => {
    e.stopPropagation();
    const initialH = block.height;
    if (initialH === undefined || initialH === null) return;
    const prevBlock = { ...block };
    setBlocks(blocks().map(b => b.id === block.id ? { ...b, height: undefined } : b));
    pushUndoAction({
      type: 'resize_block',
      blockId: block.id,
      prevX: prevBlock.pos_x,
      prevY: prevBlock.pos_y,
      prevWidth: getBlockWidth(prevBlock),
      prevHeight: initialH,
      newX: prevBlock.pos_x,
      newY: prevBlock.pos_y,
      newWidth: getBlockWidth(prevBlock),
      newHeight: undefined,
    });
    try {
      await api.updateNoteBlock(block.id, { height: 0 });
    } catch (err) {
      console.error('Failed to reset block height:', err);
    }
  };

  // Global mouse move for Dragging & Panning & Marquee
  const handleGlobalMouseMove = (e: MouseEvent) => {
    // -1. Block corner resizing in canvas-space (zero database queries during drag!)
    if (resizingBlockState) {
      const scale = zoom() / 100;
      const dx = (e.clientX - resizingBlockState.startClientX) / scale;
      const dy = (e.clientY - resizingBlockState.startClientY) / scale;
      const { initialX, initialY, initialWidth, initialHeight, corner, blockId } = resizingBlockState;

      const minW = 60;
      const minH = 36;
      let newW = initialWidth;
      let newH = initialHeight;
      let newX = initialX;
      let newY = initialY;

      switch (corner) {
        case 'se':
          newW = Math.max(minW, initialWidth + dx);
          newH = Math.max(minH, initialHeight + dy);
          break;
        case 'sw':
          newW = Math.max(minW, initialWidth - dx);
          newH = Math.max(minH, initialHeight + dy);
          newX = initialX + (initialWidth - newW);
          break;
        case 'ne':
          newW = Math.max(minW, initialWidth + dx);
          newH = Math.max(minH, initialHeight - dy);
          newY = initialY + (initialHeight - newH);
          break;
        case 'nw':
          newW = Math.max(minW, initialWidth - dx);
          newH = Math.max(minH, initialHeight - dy);
          newX = initialX + (initialWidth - newW);
          newY = initialY + (initialHeight - newH);
          break;
      }

      setBlocks(blocks().map(b => b.id === blockId ? {
        ...b,
        pos_x: Math.round(newX),
        pos_y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      } : b));
      return;
    }

    // 0. Handle drag: draw live arrow preview in canvas-space
    if (draggingHandle) {
      const dx = e.clientX - draggingHandle.startClientX;
      const dy = e.clientY - draggingHandle.startClientY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggingHandle.didDrag = true;

      if (canvasContainerRef) {
        const rect = canvasContainerRef.getBoundingClientRect();
        const scale = zoom() / 100;
        const worldX = (e.clientX - rect.left - pan().x) / scale;
        const worldY = (e.clientY - rect.top - pan().y) / scale;

        // Detect hovered target block (sticky notes cannot refer or be referred)
        const target = blocks().find(b => {
          if (b.id === draggingHandle!.blockId) return false;
          if (b.type === 'sticky') return false;
          const w = getBlockWidth(b);
          const h = getBlockHeight(b);
          return worldX >= b.pos_x && worldX <= b.pos_x + w && worldY >= b.pos_y && worldY <= b.pos_y + h;
        });

        if (target) {
          setHoveredTargetBlockId(target.id);
          const closestSide = getClosestSide(target, worldX, worldY);
          setHoveredTargetSide(closestSide);
          const snapPt = getSidePoint(target, closestSide);
          setDragArrowEnd({ x: snapPt.x, y: snapPt.y });
        } else {
          setHoveredTargetBlockId(null);
          setHoveredTargetSide(null);
          setDragArrowEnd({ x: worldX, y: worldY });
        }
      }
      return;
    }

    // 1. Panning canvas (Exact Pan Tool logic)
    if (isPanningCanvas) {
      updateCanvasPan(e.clientX, e.clientY);
      return;
    }

    // 2. Multi-Select Area Marquee
    if (isSelectingArea && canvasContainerRef) {
      const scale = zoom() / 100;
      const rect = canvasContainerRef.getBoundingClientRect();
      const currentWorldX = Math.round((e.clientX - rect.left - pan().x) / scale);
      const currentWorldY = Math.round((e.clientY - rect.top - pan().y) / scale);

      const boxX = Math.min(selectionStartWorld.x, currentWorldX);
      const boxY = Math.min(selectionStartWorld.y, currentWorldY);
      const boxW = Math.abs(currentWorldX - selectionStartWorld.x);
      const boxH = Math.abs(currentWorldY - selectionStartWorld.y);

      setSelectionBox({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH
      });

      // Find all blocks that intersect with the marquee selection box
      const hitIds = blocks().filter(b => {
        const bx = b.pos_x;
        const by = b.pos_y;
        const bw = getBlockWidth(b);
        const bh = getBlockHeight(b);

        return (
          boxX < bx + bw &&
          boxX + boxW > bx &&
          boxY < by + bh &&
          boxY + boxH > by
        );
      }).map(b => b.id);

      setSelectedBlockIds(hitIds);
      setSelectedBlockId(hitIds.length > 0 ? hitIds[0] : null);
      return;
    }

    // 3. Dragging selected block(s)
    if (draggingBlockState) {
      const scale = zoom() / 100;
      const dx = (e.clientX - draggingBlockState.startX) / scale;
      const dy = (e.clientY - draggingBlockState.startY) / scale;

      const posMap = new Map(draggingBlockState.initialPositions.map(p => [p.id, { x: p.x + dx, y: p.y + dy }]));

      setBlocks(blocks().map(b => {
        const newPos = posMap.get(b.id);
        if (newPos) {
          return {
            ...b,
            pos_x: Math.round(newPos.x),
            pos_y: Math.round(newPos.y)
          };
        }
        return b;
      }));
      return;
    }

    // 4. Track cursor position for placement ghost preview
    if (['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())) {
      const containerRect = canvasContainerRef?.getBoundingClientRect();
      if (containerRect) {
        const scale = zoom() / 100;
        const x = Math.round((e.clientX - containerRect.left - pan().x) / scale);
        const y = Math.round((e.clientY - containerRect.top - pan().y) / scale);
        setCursorCanvasPos({ x, y });
      }
    } else if (cursorCanvasPos()) {
      setCursorCanvasPos(null);
    }
  };

  // Global mouse up
  const handleGlobalMouseUp = async () => {
    stopCanvasPan();

    // Finalize block resize (single database commit on mouseUp!)
    if (resizingBlockState) {
      const r = resizingBlockState;
      resizingBlockState = null;
      const finalBlock = blocks().find(b => b.id === r.blockId);
      if (finalBlock) {
        const changed = finalBlock.pos_x !== r.initialX ||
                        finalBlock.pos_y !== r.initialY ||
                        finalBlock.width !== r.initialWidth ||
                        finalBlock.height !== r.initialHeight;
        if (changed) {
          pushUndoAction({
            type: 'resize_block',
            blockId: r.blockId,
            prevX: r.initialX,
            prevY: r.initialY,
            prevWidth: r.initialWidth,
            prevHeight: r.initialHeight,
            newX: finalBlock.pos_x,
            newY: finalBlock.pos_y,
            newWidth: finalBlock.width || r.initialWidth,
            newHeight: finalBlock.height,
          });
          try {
            await api.updateNoteBlock(finalBlock.id, {
              pos_x: finalBlock.pos_x,
              pos_y: finalBlock.pos_y,
              width: finalBlock.width,
              height: finalBlock.height,
            });
          } catch (err) {
            console.error('Failed to persist resized block:', err);
          }
        }
      }
      return;
    }

    // Finalize handle drag
    if (draggingHandle) {
      const h = draggingHandle;
      draggingHandle = null;
      setDragArrowStart(null);
      setDragArrowEnd(null);

      const targetId = hoveredTargetBlockId();
      const targetSide = hoveredTargetSide();
      setHoveredTargetBlockId(null);
      setHoveredTargetSide(null);

      if (h.didDrag && targetId) {
        // Drag → create connection to hovered block with exact connected sides
        const alreadyExists = connections().some(
          c => (c.fromId === h.blockId && c.toId === targetId) ||
               (c.fromId === targetId && c.toId === h.blockId)
        );
        const targetBlock = blocks().find(b => b.id === targetId);
        if (targetBlock && targetBlock.type !== 'sticky' && !alreadyExists) {
          const newConn: Connection = {
            fromId: h.blockId,
            toId: targetId,
            fromSide: h.side,
            toSide: targetSide || undefined
          };
          setConnections(prev => [...prev, newConn]);
          pushUndoAction({ type: 'create_connection', connection: newConn });
        }
      } else if (!h.didDrag) {
        // Click (no drag) → spawn new block of same type and auto-connect
        const srcBlock = blocks().find(b => b.id === h.blockId);
        if (srcBlock) {
          const w = getBlockWidth(srcBlock);
          const hgt = getBlockHeight(srcBlock);
          const gap = 80;
          let newX = srcBlock.pos_x;
          let newY = srcBlock.pos_y;
          switch (h.side) {
            case 'top':    newY = srcBlock.pos_y - hgt - gap; break;
            case 'right':  newX = srcBlock.pos_x + w + gap;   break;
            case 'bottom': newY = srcBlock.pos_y + hgt + gap; break;
            case 'left':   newX = srcBlock.pos_x - w - gap;   break;
          }
          await handleCreateBlockAndConnect(srcBlock, newX, newY, h.side);
        }
      }
      return;
    }

    if (isSelectingArea) {
      isSelectingArea = false;
      setSelectionBox(null);
    }

    if (draggingBlockState) {
      const movedPositions = draggingBlockState.initialPositions;
      draggingBlockState = null;

      // Persist updated positions for all moved blocks
      const currentBlocks = blocks();
      const moves: Array<{ id: string; fromX: number; fromY: number; toX: number; toY: number }> = [];

      for (const initial of movedPositions) {
        const b = currentBlocks.find(item => item.id === initial.id);
        if (b && (b.pos_x !== initial.x || b.pos_y !== initial.y)) {
          moves.push({
            id: b.id,
            fromX: initial.x,
            fromY: initial.y,
            toX: b.pos_x,
            toY: b.pos_y
          });
          try {
            await api.updateNoteBlock(b.id, {
              pos_x: b.pos_x,
              pos_y: b.pos_y
            });
          } catch (err) {
            console.error('Failed to persist block position:', err);
          }
        }
      }

      if (moves.length > 0) {
        pushUndoAction({ type: 'move_blocks', moves });
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

  // Create a block of the same type as srcBlock at (newX, newY) and connect it
  const handleCreateBlockAndConnect = async (
    srcBlock: NoteBlock,
    newX: number,
    newY: number,
    srcSide?: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    const board = boards()[0];
    if (!board) return;
    const type = srcBlock.type;
    const width = srcBlock.width || getBlockWidth(srcBlock);
    const defaultContent = type === 'shape'
      ? { text: '', shape_kind: srcBlock.content?.shape_kind || 'rectangle' }
      : { text: '' };
    try {
      const created = await api.createNoteBlock(board.id, {
        type,
        pos_x: Math.round(newX),
        pos_y: Math.round(newY),
        width,
        content: defaultContent,
      });
      pushUndoAction({ type: 'create_block', block: created });
      const oppSide = srcSide === 'right' ? 'left' : srcSide === 'left' ? 'right' : srcSide === 'top' ? 'bottom' : 'top';
      const newConn: Connection = {
        fromId: srcBlock.id,
        toId: created.id,
        fromSide: srcSide,
        toSide: srcSide ? oppSide : undefined
      };
      setBlocks(prev => [...prev, created]);
      setConnections(prev => [...prev, newConn]);
      pushUndoAction({ type: 'create_connection', connection: newConn });
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to create connected block:', err);
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

    const defaultShapeKind = selectedShapeKind();
    const defaultContent = {
      card: { text: '' },
      sticky: { text: '', color: '#44e1de' },
      text: { text: '' },
      shape: { text: '', shape_kind: defaultShapeKind },
      image: { text: '' },
      task_embed: { text: '' }
    };

    let width = 310;
    if (type === 'text') {
      width = 240;
    } else if (type === 'shape') {
      switch (defaultShapeKind) {
        case 'circle': width = 140; break;
        case 'diamond': width = 160; break;
        case 'triangle': width = 160; break;
        case 'hexagon': width = 170; break;
        default: width = 180; break;
      }
    }

    try {
      const created = await api.createNoteBlock(board.id, {
        type,
        pos_x: x,
        pos_y: y,
        width,
        content: defaultContent[type] || { text: '' }
      });

      pushUndoAction({
        type: 'create_block',
        block: created
      });

      setBlocks([...blocks(), created]);
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to create block:', err);
    }
  };


  // Handle block text edit finish, push to Undo stack, and persist to database
  const handleFinishBlockEdit = async (block: NoteBlock, finalText?: string) => {
    setEditingBlockId(null);
    if (finalText === undefined) return;
    const prevRaw = typeof block.content === 'string' ? block.content : block.content?.text ?? '';
    if (prevRaw === finalText) return;

    const prevContent = block.content || { text: '' };
    const updatedContent = typeof block.content === 'object' && block.content !== null
      ? { ...block.content, text: finalText }
      : { text: finalText };

    pushUndoAction({
      type: 'update_text',
      blockId: block.id,
      prevContent,
      newContent: updatedContent
    });

    setBlocks(blocks().map(b => b.id === block.id ? { ...b, content: updatedContent } : b));

    try {
      await api.updateNoteBlock(block.id, { content: updatedContent });
    } catch (err) {
      console.error('Failed to save block text:', err);
    }
  };

  // Update arbitrary properties in block.content (color, border_style, fill_style, locked, etc.)
  const handleUpdateBlockContent = async (blockId: string, updates: Record<string, any>) => {
    const currentBlock = blocks().find(b => b.id === blockId);
    if (!currentBlock) return;
    const prevContent = currentBlock.content || {};
    const newContent = typeof prevContent === 'object' && prevContent !== null
      ? { ...prevContent, ...updates }
      : { text: String(prevContent || ''), ...updates };

    pushUndoAction({
      type: 'update_text',
      blockId,
      prevContent,
      newContent
    });

    setBlocks(blocks().map(b => b.id === blockId ? { ...b, content: newContent } : b));

    try {
      await api.updateNoteBlock(blockId, { content: newContent });
    } catch (err) {
      console.error('Failed to update block content:', err);
    }
  };

  // Duplicate block with offset and full undo history support
  const handleDuplicateBlock = async (block: NoteBlock) => {
    const board = boards()[0];
    if (!board) return;

    const w = getBlockWidth(block);
    const offset = 24;

    const clonedContent = typeof block.content === 'object' && block.content !== null
      ? JSON.parse(JSON.stringify(block.content))
      : block.content;

    try {
      const created = await api.createNoteBlock(board.id, {
        type: block.type,
        pos_x: block.pos_x + offset,
        pos_y: block.pos_y + offset,
        width: w,
        height: block.height,
        content: clonedContent,
      });
      setBlocks(prev => [...prev, created]);
      pushUndoAction({ type: 'create_block', block: created });
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to duplicate block:', err);
    }
  };

  // Copy block to clipboard
  const handleCopyBlock = (block: NoteBlock) => {
    setCopiedBlock(JSON.parse(JSON.stringify(block)));
    const text = typeof block.content === 'object' ? block.content?.text : block.content;
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setShowContextMoreMenu(false);
  };

  // Cut block (copy and delete)
  const handleCutBlock = async (block: NoteBlock) => {
    handleCopyBlock(block);
    setShowContextMoreMenu(false);
    await handleDeleteBlocks([block.id]);
  };

  // Paste block from clipboard
  const handlePasteBlock = async () => {
    const clip = copiedBlock();
    if (!clip) return;
    const board = boards()[0];
    if (!board) return;

    const offset = 32;
    const clonedContent = typeof clip.content === 'object' && clip.content !== null
      ? JSON.parse(JSON.stringify(clip.content))
      : clip.content;

    try {
      const created = await api.createNoteBlock(board.id, {
        type: clip.type,
        pos_x: clip.pos_x + offset,
        pos_y: clip.pos_y + offset,
        width: clip.width,
        height: clip.height,
        content: clonedContent,
      });
      setBlocks(prev => [...prev, created]);
      pushUndoAction({ type: 'create_block', block: created });
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
      setCopiedBlock({ ...clip, pos_x: clip.pos_x + offset, pos_y: clip.pos_y + offset });
    } catch (err) {
      console.error('Failed to paste block:', err);
    }
  };

  // Delete multiple blocks with full undo history support
  const handleDeleteBlocks = async (blockIds: string[]) => {
    const toDelete = blocks().filter(b => blockIds.includes(b.id));
    if (toDelete.length === 0) return;

    const idSet = new Set(blockIds);
    const affectedConnections = connections().filter(c => idSet.has(c.fromId) || idSet.has(c.toId));

    pushUndoAction({
      type: 'delete_blocks',
      blocks: toDelete,
      connections: affectedConnections
    });

    setBlocks(blocks().filter(b => !idSet.has(b.id)));
    setConnections(connections().filter(c => !idSet.has(c.fromId) && !idSet.has(c.toId)));
    if (selectedBlockId() && idSet.has(selectedBlockId()!)) setSelectedBlockId(null);
    setSelectedBlockIds(selectedBlockIds().filter(id => !idSet.has(id)));

    for (const id of blockIds) {
      try {
        await api.deleteNoteBlock(id);
      } catch (err) {
        console.error('Failed to delete block:', err);
      }
    }
  };


  // Canvas Undo Handler (Ctrl+Z)
  const handleUndo = async () => {
    const stack = undoStack();
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    switch (action.type) {
      case 'create_block': {
        setBlocks(prev => prev.filter(b => b.id !== action.block.id));
        setConnections(prev => prev.filter(c => c.fromId !== action.block.id && c.toId !== action.block.id));
        if (selectedBlockId() === action.block.id) setSelectedBlockId(null);
        setSelectedBlockIds(prev => prev.filter(id => id !== action.block.id));
        try {
          await api.deleteNoteBlock(action.block.id);
        } catch (e) {
          console.error('Undo create block failed:', e);
        }
        break;
      }
      case 'delete_blocks': {
        setBlocks(prev => [...prev, ...action.blocks]);
        if (action.connections && action.connections.length > 0) {
          setConnections(prev => [...prev, ...action.connections]);
        }
        const board = boards()[0];
        if (board) {
          for (const b of action.blocks) {
            try {
              await api.createNoteBlock(board.id, {
                id: b.id,
                type: b.type,
                pos_x: b.pos_x,
                pos_y: b.pos_y,
                width: b.width,
                height: b.height,
                content: b.content
              });
            } catch (e) {
              console.error('Undo delete block failed:', e);
            }
          }
        }
        break;
      }
      case 'move_blocks': {
        const moveMap = new Map(action.moves.map(m => [m.id, { x: m.fromX, y: m.fromY }]));
        setBlocks(prev => prev.map(b => {
          const p = moveMap.get(b.id);
          return p ? { ...b, pos_x: p.x, pos_y: p.y } : b;
        }));
        for (const m of action.moves) {
          try {
            await api.updateNoteBlock(m.id, { pos_x: m.fromX, pos_y: m.fromY });
          } catch (e) {
            console.error('Undo move block failed:', e);
          }
        }
        break;
      }
      case 'update_text': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? { ...b, content: action.prevContent } : b));
        try {
          await api.updateNoteBlock(action.blockId, { content: action.prevContent });
        } catch (e) {
          console.error('Undo text update failed:', e);
        }
        break;
      }
      case 'create_connection': {
        setConnections(prev => prev.filter(c => !(c.fromId === action.connection.fromId && c.toId === action.connection.toId)));
        break;
      }
      case 'delete_connection': {
        setConnections(prev => [...prev, action.connection]);
        break;
      }
      case 'resize_block': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? {
          ...b,
          pos_x: action.prevX,
          pos_y: action.prevY,
          width: action.prevWidth,
          height: action.prevHeight,
        } : b));
        try {
          await api.updateNoteBlock(action.blockId, {
            pos_x: action.prevX,
            pos_y: action.prevY,
            width: action.prevWidth,
            height: action.prevHeight ?? 0,
          });
        } catch (e) {
          console.error('Undo resize block failed:', e);
        }
        break;
      }
    }

    setRedoStack(prev => [...prev, action]);
  };

  // Canvas Redo Handler (Ctrl+Y or Ctrl+Shift+Z)
  const handleRedo = async () => {
    const stack = redoStack();
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));

    switch (action.type) {
      case 'create_block': {
        setBlocks(prev => [...prev, action.block]);
        const board = boards()[0];
        if (board) {
          try {
            await api.createNoteBlock(board.id, {
              id: action.block.id,
              type: action.block.type,
              pos_x: action.block.pos_x,
              pos_y: action.block.pos_y,
              width: action.block.width,
              height: action.block.height,
              content: action.block.content
            });
          } catch (e) {
            console.error('Redo create block failed:', e);
          }
        }
        break;
      }
      case 'delete_blocks': {
        const idSet = new Set(action.blocks.map(b => b.id));
        setBlocks(prev => prev.filter(b => !idSet.has(b.id)));
        setConnections(prev => prev.filter(c => !idSet.has(c.fromId) && !idSet.has(c.toId)));
        if (selectedBlockId() && idSet.has(selectedBlockId()!)) setSelectedBlockId(null);
        setSelectedBlockIds(prev => prev.filter(id => !idSet.has(id)));
        for (const b of action.blocks) {
          try {
            await api.deleteNoteBlock(b.id);
          } catch (e) {
            console.error('Redo delete block failed:', e);
          }
        }
        break;
      }
      case 'move_blocks': {
        const moveMap = new Map(action.moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
        setBlocks(prev => prev.map(b => {
          const p = moveMap.get(b.id);
          return p ? { ...b, pos_x: p.x, pos_y: p.y } : b;
        }));
        for (const m of action.moves) {
          try {
            await api.updateNoteBlock(m.id, { pos_x: m.toX, pos_y: m.toY });
          } catch (e) {
            console.error('Redo move block failed:', e);
          }
        }
        break;
      }
      case 'update_text': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? { ...b, content: action.newContent } : b));
        try {
          await api.updateNoteBlock(action.blockId, { content: action.newContent });
        } catch (e) {
          console.error('Redo text update failed:', e);
        }
        break;
      }
      case 'create_connection': {
        setConnections(prev => [...prev, action.connection]);
        break;
      }
      case 'delete_connection': {
        setConnections(prev => prev.filter(c => !(c.fromId === action.connection.fromId && c.toId === action.connection.toId)));
        break;
      }
      case 'resize_block': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? {
          ...b,
          pos_x: action.newX,
          pos_y: action.newY,
          width: action.newWidth,
          height: action.newHeight,
        } : b));
        try {
          await api.updateNoteBlock(action.blockId, {
            pos_x: action.newX,
            pos_y: action.newY,
            width: action.newWidth,
            height: action.newHeight ?? 0,
          });
        } catch (e) {
          console.error('Redo resize block failed:', e);
        }
        break;
      }
    }

    setUndoStack(prev => [...prev, action]);
  };

  const handleDeleteConnection = (conn: Connection) => {
    setConnections(prev => prev.filter(c => !(c.fromId === conn.fromId && c.toId === conn.toId)));
    pushUndoAction({ type: 'delete_connection', connection: conn });
    if (selectedConnection() && selectedConnection()?.fromId === conn.fromId && selectedConnection()?.toId === conn.toId) {
      setSelectedConnection(null);
    }
  };

  // Helper: compute best attachment point (canvas coords) on a block given direction from center of another block
  const getBestAttachPoint = (block: NoteBlock, fromCenterX: number, fromCenterY: number): { x: number; y: number; side: 'top' | 'right' | 'bottom' | 'left' } => {
    const w = getBlockWidth(block);
    const h = getBlockHeight(block);
    const cx = block.pos_x + w / 2;
    const cy = block.pos_y + h / 2;
    const dx = fromCenterX - cx;
    const dy = fromCenterY - cy;
    const nx = dx / (w / 2 || 1);
    const ny = dy / (h / 2 || 1);
    if (Math.abs(nx) >= Math.abs(ny)) {
      if (dx > 0) return { x: block.pos_x + w, y: cy, side: 'right' };
      else        return { x: block.pos_x,     y: cy, side: 'left' };
    } else {
      if (dy > 0) return { x: cx, y: block.pos_y + h, side: 'bottom' };
      else        return { x: cx, y: block.pos_y,      side: 'top' };
    }
  };

  // Render smart SVG Bézier curves for all active connections
  const renderConnectorCurves = () => {
    const blist = blocks();
    return connections().map(conn => {
      const b1 = blist.find(b => b.id === conn.fromId);
      const b2 = blist.find(b => b.id === conn.toId);
      if (!b1 || !b2) return null;
      if (b1.type === 'sticky' || b2.type === 'sticky') return null;

      const cx2 = b2.pos_x + getBlockWidth(b2) / 2;
      const cy2 = b2.pos_y + getBlockHeight(b2) / 2;

      // Exit point on b1
      const p1 = conn.fromSide
        ? getSidePoint(b1, conn.fromSide)
        : getBestAttachPoint(b1, cx2, cy2);

      // Entry point on b2
      const p2 = conn.toSide
        ? getSidePoint(b2, conn.toSide)
        : getBestAttachPoint(b2, p1.x, p1.y);

      // Build bezier control points perpendicular to each side
      const ctrlDist = Math.max(50, Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) * 0.35);
      const sideOffset = (side: string): [number, number] => {
        switch (side) {
          case 'right':  return [ctrlDist, 0];
          case 'left':   return [-ctrlDist, 0];
          case 'bottom': return [0, ctrlDist];
          case 'top':    return [0, -ctrlDist];
          default: return [0, 0];
        }
      };
      const [c1dx, c1dy] = sideOffset(p1.side);
      const [c2dx, c2dy] = sideOffset(p2.side);
      const pathData = `M ${p1.x} ${p1.y} C ${p1.x + c1dx} ${p1.y + c1dy}, ${p2.x + c2dx} ${p2.y + c2dy}, ${p2.x} ${p2.y}`;

      const isSelected = selectedConnection() && selectedConnection()?.fromId === conn.fromId && selectedConnection()?.toId === conn.toId;

      return (
        <g class="connector-curve-group">
          {/* Transparent hit path for easy clicking & selecting */}
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            stroke-width="16"
            style={{ "pointer-events": 'stroke', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedConnection(conn);
              setSelectedBlockId(null);
              setSelectedBlockIds([]);
            }}
          />
          {/* Visible connector line */}
          <path
            d={pathData}
            fill="none"
            stroke={isSelected ? '#ffffff' : '#3b82f6'}
            stroke-width={isSelected ? '2.4' : '1.8'}
            opacity={isSelected ? '1' : '0.8'}
            marker-end={isSelected ? 'url(#orca-arrowhead-selected)' : 'url(#orca-arrowhead)'}
            style={{ "pointer-events": 'none' }}
          />
          {/* Delete pill button on selected connection */}
          <Show when={isSelected}>
            {(() => {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              return (
                <foreignObject
                  x={midX - 12}
                  y={midY - 12}
                  width="24"
                  height="24"
                  style={{ overflow: 'visible', "pointer-events": 'all' }}
                >
                  <button
                    title="Delete connection"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConnection(conn);
                    }}
                    style={{
                      width: '24px',
                      height: '24px',
                      "border-radius": '50%',
                      background: '#ef4444',
                      border: '2px solid #ffffff',
                      color: '#ffffff',
                      display: 'flex',
                      "align-items": 'center',
                      "justify-content": 'center',
                      cursor: 'pointer',
                      padding: 0,
                      "font-size": '12px',
                      "font-weight": 'bold',
                      "box-shadow": '0 2px 8px rgba(0,0,0,0.5)'
                    }}
                  >
                    ✕
                  </button>
                </foreignObject>
              );
            })()}
          </Show>
        </g>
      );
    });
  };

  // Render connection and resize handles as canvas-space overlay (outside blocks to avoid overflow:hidden clip)
  const renderCanvasHandles = () => {
    const HANDLE_TYPES: Array<'card' | 'text' | 'shape'> = ['card', 'text', 'shape'];
    const selectedBlocks = blocks().filter(
      b => (selectedBlockIds().includes(b.id) || selectedBlockId() === b.id) && editingBlockId() !== b.id
    );

    return (
      <For each={selectedBlocks}>
        {(block) => {
          if (block.content?.locked) return null;
          const w = getBlockWidth(block);
          const h = getBlockHeight(block);
          const HANDLE_SIZE = 14;

          const isConnectable = (HANDLE_TYPES as string[]).includes(block.type);
          const handles: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; cx: number; cy: number }> = isConnectable ? [
            { side: 'top',    cx: block.pos_x + w / 2, cy: block.pos_y },
            { side: 'right',  cx: block.pos_x + w,     cy: block.pos_y + h / 2 },
            { side: 'bottom', cx: block.pos_x + w / 2, cy: block.pos_y + h },
            { side: 'left',   cx: block.pos_x,          cy: block.pos_y + h / 2 },
          ] : [];

          const resizeCorners: Array<{ corner: 'nw' | 'ne' | 'se' | 'sw'; cx: number; cy: number; cursor: string }> = [
            { corner: 'nw', cx: block.pos_x,     cy: block.pos_y,     cursor: 'nwse-resize' },
            { corner: 'ne', cx: block.pos_x + w, cy: block.pos_y,     cursor: 'nesw-resize' },
            { corner: 'se', cx: block.pos_x + w, cy: block.pos_y + h, cursor: 'nwse-resize' },
            { corner: 'sw', cx: block.pos_x,     cy: block.pos_y + h, cursor: 'nesw-resize' },
          ];

          return (
            <>
              {/* 4 Corner Resize Handles */}
              <For each={resizeCorners}>
                {(rc) => (
                  <div
                    class="canvas-resize-handle"
                    style={{
                      left: `${rc.cx}px`,
                      top: `${rc.cy}px`,
                      cursor: rc.cursor,
                    }}
                    title="Drag corner to resize. Double-click to reset height to auto."
                    onMouseDown={(e) => handleResizeMouseDown(e, block, rc.corner)}
                    onDblClick={(e) => handleResetBlockDimensions(e, block)}
                  />
                )}
              </For>

              {/* 4 Edge Connection Handles */}
              <For each={handles}>
                {(handle) => (
                  <div
                    class="canvas-handle"
                    style={{
                      left: `${handle.cx}px`,
                      top: `${handle.cy}px`,
                      transform: 'translate(-50%, -50%)',
                      width: `${HANDLE_SIZE}px`,
                      height: `${HANDLE_SIZE}px`,
                    }}
                    onMouseDown={(e) => handleHandleMouseDown(e, block, handle.side)}
                  />
                )}
              </For>
            </>
          );
        }}
      </For>
    );
  };

  // Render contextual floating action bar above the selected object
  const renderContextualToolbar = () => {
    const block = primarySelectedBlock();
    if (!block) return null;

    const w = getBlockWidth(block);
    const posX = block.pos_x + w / 2;
    const posY = block.pos_y - 12;

    const isLocked = Boolean(block.content?.locked);
    const currentColor = block.content?.color || '#44e1de';
    const currentBorderStyle = block.content?.border_style || 'solid';
    const currentFillStyle = block.content?.fill_style || 'solid';

    const COLOR_PALETTE = [
      { name: 'Dark (Default)', value: '#1e2025' },
      { name: 'Pure White', value: '#ffffff' },
      { name: 'Ocean Blue', value: '#2563eb' },
      { name: 'Teal', value: '#0d9488' },
      { name: 'Purple', value: '#7c3aed' },
      { name: 'Rose Red', value: '#e11d48' },
      { name: 'Amber Orange', value: '#d97706' },
      { name: 'Emerald Green', value: '#16a34a' },
      { name: 'Slate Gray', value: '#475569' },
    ];

    return (
      <div
        class="canvas-context-toolbar"
        style={{
          left: `${posX}px`,
          top: `${posY}px`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Edit Text Tool */}
        <button
          class="ctx-btn"
          title="Edit text (or double-click block)"
          onClick={() => {
            setEditingBlockId(block.id);
            setShowContextColorPicker(false);
            setShowContextMoreMenu(false);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>Edit</span>
        </button>

        <div class="ctx-divider" />

        {/* 2. Color Picker Tool */}
        <div style={{ position: 'relative' }}>
          <button
            class={`ctx-btn ${showContextColorPicker() ? 'active' : ''}`}
            title="Color / Warna"
            onClick={() => {
              setShowContextColorPicker(!showContextColorPicker());
              setShowContextMoreMenu(false);
            }}
          >
            <div
              style={{
                width: '13px',
                height: '13px',
                "border-radius": '50%',
                background: currentColor,
                border: '1.5px solid rgba(255,255,255,0.4)',
              }}
            />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {/* Color Popover */}
          <Show when={showContextColorPicker()}>
            <div class="ctx-popover" onClick={(e) => e.stopPropagation()}>
              <For each={COLOR_PALETTE}>
                {(c) => (
                  <div
                    class={`ctx-color-swatch ${block.content?.color === c.value ? 'active' : ''}`}
                    style={{ background: c.value }}
                    title={c.name}
                    onClick={() => {
                      handleUpdateBlockContent(block.id, { color: c.value });
                      setShowContextColorPicker(false);
                    }}
                  />
                )}
              </For>
              <div
                class="ctx-color-swatch"
                style={{
                  background: 'transparent',
                  border: '1.5px dashed rgba(255,255,255,0.4)',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'center',
                  "font-size": '10px',
                  color: '#94a3b8'
                }}
                title="Reset color"
                onClick={() => {
                  handleUpdateBlockContent(block.id, { color: undefined });
                  setShowContextColorPicker(false);
                }}
              >
                ✕
              </div>
            </div>
          </Show>
        </div>

        {/* 3. Outline Solid atau Dash */}
        <button
          class="ctx-btn"
          title={`Outline style: ${currentBorderStyle === 'dashed' ? 'Dashed' : 'Solid'}`}
          onClick={() => {
            const next = currentBorderStyle === 'dashed' ? 'solid' : 'dashed';
            handleUpdateBlockContent(block.id, { border_style: next });
          }}
        >
          <Show when={currentBorderStyle === 'dashed'} fallback={
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          }>
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4,4">
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          </Show>
          <span>{currentBorderStyle === 'dashed' ? 'Dash' : 'Solid'}</span>
        </button>

        {/* 4. Fill Tool (Solid vs Transparent) */}
        <button
          class="ctx-btn"
          title={`Fill: ${currentFillStyle === 'transparent' ? 'Transparent' : 'Solid'}`}
          onClick={() => {
            const next = currentFillStyle === 'transparent' ? 'solid' : 'transparent';
            handleUpdateBlockContent(block.id, { fill_style: next });
          }}
        >
          <Show when={currentFillStyle === 'transparent'} fallback={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          }>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="4" y1="20" x2="20" y2="4" stroke-width="1.5" />
            </svg>
          </Show>
          <span>{currentFillStyle === 'transparent' ? 'Transparent' : 'Solid'}</span>
        </button>

        <div class="ctx-divider" />

        {/* 5. Duplicate Tool */}
        <button
          class="ctx-btn"
          title="Duplicate (Ctrl+D)"
          onClick={() => handleDuplicateBlock(block)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>

        {/* 6. Lock Tool Toggle */}
        <button
          class={`ctx-btn ${isLocked ? 'active' : ''}`}
          title={isLocked ? "Unlock object" : "Lock object"}
          onClick={() => handleUpdateBlockContent(block.id, { locked: !isLocked })}
          style={isLocked ? { color: '#fbbf24', 'background-color': 'rgba(251, 191, 36, 0.15)', 'border-color': 'rgba(251, 191, 36, 0.3)' } : {}}
        >
          <Show when={isLocked} fallback={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
          }>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </Show>
        </button>

        {/* 7. Tombol Titik 3 (... More Options) */}
        <div style={{ position: 'relative' }}>
          <button
            class={`ctx-btn ${showContextMoreMenu() ? 'active' : ''}`}
            title="More options"
            onClick={() => {
              setShowContextMoreMenu(!showContextMoreMenu());
              setShowContextColorPicker(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
          </button>

          {/* More Options Dropdown */}
          <Show when={showContextMoreMenu()}>
            <div class="ctx-menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <button
                class="ctx-menu-item"
                onClick={() => handleCopyBlock(block)}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </span>
                <span class="ctx-menu-badge">Ctrl+C</span>
              </button>

              <button
                class="ctx-menu-item"
                onClick={() => handleCutBlock(block)}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="6" cy="6" r="3"/>
                    <circle cx="6" cy="18" r="3"/>
                    <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                    <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
                  </svg>
                  Cut
                </span>
                <span class="ctx-menu-badge">Ctrl+X</span>
              </button>

              <button
                class="ctx-menu-item"
                onClick={() => {
                  handleUpdateBlockContent(block.id, { locked: !isLocked });
                  setShowContextMoreMenu(false);
                }}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <Show when={isLocked} fallback={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  }>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                  </Show>
                  {isLocked ? 'Unlock' : 'Lock'}
                </span>
              </button>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

              <button
                class="ctx-menu-item danger"
                onClick={() => {
                  setShowContextMoreMenu(false);
                  handleDeleteBlocks([block.id]);
                }}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </span>
                <span class="ctx-menu-badge">Del</span>
              </button>
            </div>
          </Show>
        </div>
      </div>
    );
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
              onMouseLeave={() => setCursorCanvasPos(null)}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                "background-color": '#111317',
                overflow: 'hidden',
                "touch-action": 'none',
                cursor: isActivelyPanning() 
                  ? 'grabbing' 
                  : isSelectingArea
                  ? 'crosshair'
                  : ['card', 'sticky', 'text', 'shape', 'connector'].includes(activeCanvasTool())
                  ? 'crosshair'
                  : (activeCanvasTool() === 'pan' || isSpacePressed() ? 'grab' : 'default')
              }}
            >
              {/* Board Header Info */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', "z-index": 15, display: 'flex', "align-items": 'center', gap: '8px', padding: '6px 12px', "border-radius": '6px', "background-color": '#181a20', border: '1px solid #2e323b', "font-size": '11px', color: 'var(--text-muted)' }}>
                <span style={{ color: '#3b82f6', "font-family": 'var(--font-mono)' }}>CANVAS:</span>
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
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'visible',
                    "pointer-events": 'none',
                    "z-index": 10
                  }}
                >
                  <defs>
                    <marker id="orca-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
                    </marker>
                    <marker id="orca-arrowhead-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="#ffffff" />
                    </marker>
                  </defs>
                  {renderConnectorCurves()}
                </svg>

                {/* Live Arrow Preview (canvas-space) when dragging a handle */}
                <Show when={dragArrowStart() && dragArrowEnd()}>
                  {(() => {
                    const s = dragArrowStart()!;
                    const t = dragArrowEnd()!;
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const ux = len > 0 ? dx / len : 1;
                    const uy = len > 0 ? dy / len : 0;
                    // Arrow tip retracted slightly
                    const tipX = t.x - ux * 6;
                    const tipY = t.y - uy * 6;
                    const ctrl = Math.max(40, len * 0.4);
                    const c1x = s.x + ux * ctrl;
                    const c1y = s.y + uy * ctrl;
                    const c2x = tipX - ux * ctrl;
                    const c2y = tipY - uy * ctrl;
                    return (
                      <svg
                        class="canvas-arrow-preview"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 'pointer-events': 'none', 'z-index': 60, overflow: 'visible' }}
                      >
                        <defs>
                          <marker id="arrow-preview-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
                          </marker>
                        </defs>
                        <path
                          d={`M ${s.x} ${s.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tipX} ${tipY}`}
                          fill="none"
                          stroke="#3b82f6"
                          stroke-width="2"
                          stroke-dasharray="6 4"
                          opacity="0.9"
                          marker-end="url(#arrow-preview-head)"
                        />
                      </svg>
                    );
                  })()}
                </Show>

                {/* Multi-Select Area Marquee Box */}
                <Show when={selectionBox()}>
                  <div
                    class="canvas-selection-marquee"
                    style={{
                      left: `${selectionBox()!.x}px`,
                      top: `${selectionBox()!.y}px`,
                      width: `${selectionBox()!.width}px`,
                      height: `${selectionBox()!.height}px`
                    }}
                  />
                </Show>

                {/* Ghost Preview Silhouette for active placement tool */}
                <Show when={cursorCanvasPos() && ['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())}>
                  {(() => {
                    const tool = activeCanvasTool();
                    const pos = cursorCanvasPos()!;
                    const isSticky = tool === 'sticky';
                    const isShape = tool === 'shape';
                    const isText = tool === 'text';
                    const shapeKind = selectedShapeKind();

                    let width = 310;
                    let height = 210;
                    if (isText) {
                      width = 240;
                      height = 65;
                    } else if (isShape) {
                      switch (shapeKind) {
                        case 'circle': width = 140; height = 100; break;
                        case 'diamond': width = 160; height = 110; break;
                        case 'triangle': width = 160; height = 120; break;
                        case 'hexagon': width = 170; height = 85; break;
                        default: width = 180; height = 70; break;
                      }
                    }

                    if (isShape && ['diamond', 'triangle', 'hexagon'].includes(shapeKind)) {
                      return (
                        <div
                          class="canvas-ghost-preview"
                          style={{
                            left: `${pos.x}px`,
                            top: `${pos.y}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            border: 'none',
                            background: 'transparent',
                            "box-shadow": 'none'
                          }}
                        >
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                            <polygon
                              points={
                                shapeKind === 'diamond'
                                  ? '50,2 98,50 50,98 2,50'
                                  : shapeKind === 'triangle'
                                  ? '50,2 98,98 2,98'
                                  : '25,2 75,2 98,50 75,98 25,98 2,50'
                              }
                              fill="rgba(59, 130, 246, 0.08)"
                              stroke="#3b82f6"
                              stroke-width="1.5"
                              vector-effect="non-scaling-stroke"
                            />
                          </svg>
                        </div>
                      );
                    }

                    return (
                      <div
                        class="canvas-ghost-preview"
                        style={{
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          border: isSticky 
                            ? '2px dashed #3b82f6' 
                            : isShape 
                            ? '1.5px solid #3b82f6' 
                            : isText 
                            ? '1px dashed rgba(255,255,255,0.6)' 
                            : '2px dashed #3b82f6',
                          background: isSticky 
                            ? '#1c1f27' 
                            : isShape 
                            ? '#1a1d24' 
                            : isText 
                            ? 'transparent' 
                            : '#181a20',
                          "border-radius": isShape ? (shapeKind === 'circle' ? '9999px' : '8px') : isSticky ? '4px' : '8px',
                          "clip-path": isSticky ? 'polygon(0px 0px, calc(100% - 16px) 0px, 100% 16px, 100% 100%, 0px 100%)' : undefined,
                          "box-shadow": '0 8px 24px rgba(0, 0, 0, 0.4)'
                        }}
                      />
                    );
                  })()}
                </Show>

                {/* Dynamic Blocks */}
                <For each={blocks()}>
                  {(block) => {
                    const isSelected = () => selectedBlockIds().includes(block.id) || selectedBlockId() === block.id;
                    const isConnectingSource = () => connectingSourceId() === block.id;

                    const blockTypeClass = () => {
                      switch (block.type) {
                        case 'sticky': return 'canvas-block-sticky';
                        case 'text': return 'canvas-block-text';
                        case 'shape': return `canvas-block-shape canvas-shape-${block.content?.shape_kind || 'rectangle'}`;
                        default: return 'canvas-block-card';
                      }
                    };

                    const isSvgShape = () => block.type === 'shape' && ['diamond', 'triangle', 'hexagon'].includes(block.content?.shape_kind);
                    const isLocked = () => Boolean(block.content?.locked);
                    const blockColor = () => block.content?.color;
                    const borderStyle = () => block.content?.border_style || 'solid';
                    const fillStyle = () => block.content?.fill_style || 'solid';

                    return (
                      <div
                        ref={(el) => {
                          if (el) {
                            const updateH = () => {
                              const h = el.offsetHeight;
                              if (h > 0 && blockDomHeights()[block.id] !== h) {
                                setBlockDomHeights(prev => ({ ...prev, [block.id]: h }));
                              }
                            };
                            updateH();
                            const ro = new ResizeObserver(updateH);
                            ro.observe(el);
                            onCleanup(() => ro.disconnect());
                          }
                        }}
                        onMouseDown={(e) => handleBlockMouseDown(e, block)}
                        onDblClick={(e) => {
                          e.stopPropagation();
                          if (isLocked()) return;
                          setEditingBlockId(block.id);
                          setSelectedBlockId(block.id);
                          setSelectedBlockIds([block.id]);
                        }}
                        class={`canvas-block ${blockTypeClass()} ${isSelected() ? 'selected' : ''} ${hoveredTargetBlockId() === block.id ? 'handle-drop-target' : ''} ${isLocked() ? 'locked' : ''}`}
                        style={{
                          left: `${block.pos_x}px`,
                          top: `${block.pos_y}px`,
                          width: `${getBlockWidth(block)}px`,
                          height: block.height && block.height > 0 ? `${block.height}px` : 'auto',
                          "min-height": block.height && block.height > 0
                            ? '36px'
                            : block.type === 'shape'
                            ? (block.content?.shape_kind === 'circle' ? '100px'
                              : block.content?.shape_kind === 'diamond' ? '110px'
                              : block.content?.shape_kind === 'triangle' ? '120px'
                              : block.content?.shape_kind === 'hexagon' ? '85px'
                              : '70px')
                            : block.type === 'text' ? '36px' : '70px',
                          "border-color": !isSvgShape() ? (blockColor() || 'rgba(255, 255, 255, 0.18)') : undefined,
                          "border-style": !isSvgShape() && borderStyle() === 'dashed' ? 'dashed' : 'solid',
                          background: !isSvgShape()
                            ? (fillStyle() === 'transparent' ? 'transparent' : (blockColor() || '#1a1d24'))
                            : undefined,
                          color: fillStyle() !== 'transparent' && blockColor() === '#ffffff' ? '#0f172a' : '#ffffff',
                          outline: isConnectingSource() && !isSvgShape() ? '2px dashed #3b82f6' : undefined
                        }}
                      >
                        {/* Lock Badge */}
                        <Show when={isLocked()}>
                          <div class="block-lock-badge" title="Locked (Click Unlock in toolbar above)">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </div>
                        </Show>

                        {/* SVG frame for diamond, triangle, hexagon */}
                        <Show when={isSvgShape()}>
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="shape-svg-border">
                            <polygon
                              points={
                                block.content?.shape_kind === 'diamond'
                                  ? '50,2 98,50 50,98 2,50'
                                  : block.content?.shape_kind === 'triangle'
                                  ? '50,2 98,98 2,98'
                                  : '25,2 75,2 98,50 75,98 25,98 2,50'
                              }
                              fill={
                                fillStyle() === 'transparent'
                                  ? 'transparent'
                                  : (blockColor() || '#1a1d24')
                              }
                              stroke={isSelected() || isConnectingSource() ? '#3b82f6' : (blockColor() || 'rgba(255, 255, 255, 0.18)')}
                              stroke-width={isSelected() || isConnectingSource() ? '2' : '1.5'}
                              stroke-dasharray={borderStyle() === 'dashed' ? '6,4' : undefined}
                              vector-effect="non-scaling-stroke"
                            />
                          </svg>
                        </Show>

                        {/* Connection Handles are rendered in canvas world overlay below — not inside block */}

                        <UnifiedMarkdownBlock
                          block={block}
                          isEditing={editingBlockId() === block.id}
                          onStartEdit={() => {
                            if (isLocked()) return;
                            setEditingBlockId(block.id);
                            setSelectedBlockId(block.id);
                            setSelectedBlockIds([block.id]);
                          }}
                          onFinishEdit={(finalText) => handleFinishBlockEdit(block, finalText)}
                        />
                      </div>
                    );
                  }}
                </For>

                {/* Canvas-space Connection Handles Overlay (outside blocks to avoid overflow:hidden clip) */}
                <div style={{ position: 'absolute', inset: 0, 'pointer-events': 'none', 'z-index': 35 }}>
                  <div style={{ 'pointer-events': 'all' }}>
                    {renderCanvasHandles()}
                  </div>
                </div>

                {/* Contextual Action Bar above Selected Object */}
                <Show when={primarySelectedBlock() && !editingBlockId() && !isSelectingArea && !draggingBlockState && !resizingBlockState}>
                  {renderContextualToolbar()}
                </Show>
              </div>

              {/* =========================================================
                 FLOATING OBSIDIAN GLASS CANVAS TOOLBAR
                 ========================================================= */}
              <div class="canvas-toolbar">
                {/* Pointer / Select */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'select' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('select')}
                >
                  <MousePointer size={15} />
                  <span class="tool-tooltip">
                    Select & Move <span class="tool-tooltip-kbd">V</span>
                  </span>
                </button>

                {/* Pan Tool */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'pan' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool('pan')}
                >
                  <Hand size={15} />
                  <span class="tool-tooltip">
                    Hand / Pan <span class="tool-tooltip-kbd">H</span>
                  </span>
                </button>

                <div class="tool-divider"></div>

                {/* Undo Tool */}
                <button 
                  class={`tool-btn ${undoStack().length === 0 ? 'disabled' : ''}`}
                  onClick={handleUndo}
                  disabled={undoStack().length === 0}
                  style={{ opacity: undoStack().length === 0 ? 0.35 : 1, cursor: undoStack().length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <Undo size={15} />
                  <span class="tool-tooltip">
                    Undo <span class="tool-tooltip-kbd">Ctrl+Z</span>
                  </span>
                </button>

                {/* Redo Tool */}
                <button 
                  class={`tool-btn ${redoStack().length === 0 ? 'disabled' : ''}`}
                  onClick={handleRedo}
                  disabled={redoStack().length === 0}
                  style={{ opacity: redoStack().length === 0 ? 0.35 : 1, cursor: redoStack().length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <Redo size={15} />
                  <span class="tool-tooltip">
                    Redo <span class="tool-tooltip-kbd">Ctrl+Y</span>
                  </span>
                </button>

                <div class="tool-divider"></div>

                {/* Add Card */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'card' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'card' ? 'select' : 'card')}
                >
                  <LayoutGrid size={15} />
                  <span class="tool-tooltip">
                    Card <span class="tool-tooltip-kbd">C</span>
                  </span>
                </button>

                {/* Add Sticky Note */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'sticky' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'sticky' ? 'select' : 'sticky')}
                >
                  <StickyNote size={15} />
                  <span class="tool-tooltip">
                    Sticky Note <span class="tool-tooltip-kbd">S</span>
                  </span>
                </button>

                {/* Add Text Block */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'text' ? 'select' : 'text')}
                >
                  <Type size={15} />
                  <span class="tool-tooltip">
                    Text Block <span class="tool-tooltip-kbd">T</span>
                  </span>
                </button>

                {/* Add Shape Container & Popover */}
                <div class={`shape-tool-wrapper ${showShapePicker() ? 'popover-open' : ''}`}>
                  <Show when={showShapePicker()}>
                    <div class="shape-picker-popover" onClick={(e) => e.stopPropagation()}>
                      <div class="shape-picker-header">Shapes</div>
                      <div class="shape-picker-list">
                        <For each={SHAPE_OPTIONS}>
                          {(option) => {
                            const Icon = option.icon;
                            const isSelected = () => selectedShapeKind() === option.id;
                            return (
                              <button
                                type="button"
                                class={`shape-option-btn ${isSelected() ? 'active' : ''}`}
                                title={option.label}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShapeKind(option.id);
                                  localStorage.setItem('orca_last_shape_kind', option.id);
                                  setActiveCanvasTool('shape');
                                  setShowShapePicker(false);
                                }}
                              >
                                <Icon size={16} />
                                <span class="shape-option-label">{option.label}</span>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <button 
                    class={`tool-btn ${activeCanvasTool() === 'shape' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeCanvasTool() !== 'shape') {
                        setActiveCanvasTool('shape');
                        setShowShapePicker(true);
                      } else {
                        setShowShapePicker(prev => !prev);
                      }
                    }}
                  >
                    <DynamicShapeIcon kind={selectedShapeKind()} size={15} />
                    <span class="tool-tooltip">
                      {`Shape (${selectedShapeKind()})`} <span class="tool-tooltip-kbd">R</span>
                    </span>
                  </button>
                </div>

                {/* Connector Tool */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'connector' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCanvasTool(activeCanvasTool() === 'connector' ? 'select' : 'connector');
                    setConnectingSourceId(null);
                  }}
                >
                  <Share2 size={15} />
                  <span class="tool-tooltip">
                    Connect <span class="tool-tooltip-kbd">L</span>
                  </span>
                </button>

                <div class="tool-divider"></div>

                {/* Zoom Controls */}
                <div style={{ display: 'flex', "align-items": 'center', gap: '2px', "font-size": '11px', "font-family": 'var(--font-mono)' }}>
                  <button 
                    onClick={() => setZoom(z => Math.max(50, z - 10))} 
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                  >
                    -
                    <span class="tool-tooltip">
                      Zoom Out <span class="tool-tooltip-kbd">-</span>
                    </span>
                  </button>
                  <span 
                    class="tool-zoom-badge"
                    onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); }}
                    style={{ padding: '0 6px', color: 'var(--text-muted)', cursor: 'pointer', "user-select": 'none' }}
                  >
                    {zoom()}%
                    <span class="tool-tooltip">
                      Reset View <span class="tool-tooltip-kbd">100%</span>
                    </span>
                  </span>
                  <button 
                    onClick={() => setZoom(z => Math.min(150, z + 10))} 
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                  >
                    +
                    <span class="tool-tooltip">
                      Zoom In <span class="tool-tooltip-kbd">+</span>
                    </span>
                  </button>
                  <button 
                    onClick={() => { setZoom(100); setPan({ x: 0, y: 0 }); }}
                    class="tool-btn" 
                    style={{ width: '26px', height: '26px' }}
                  >
                    <Maximize2 size={12} />
                    <span class="tool-tooltip">
                      Fit / Center
                    </span>
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
