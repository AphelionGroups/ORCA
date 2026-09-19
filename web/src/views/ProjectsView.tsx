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

// -------------------------------------------------------------
// INLINE LIVE MARKDOWN PARSER & LINE-BY-LINE LIVE EDITOR
// -------------------------------------------------------------
function renderMarkdownLine(raw: string): { type: string; contentHtml: string } {
  if (!raw || !raw.trim()) {
    return { type: 'empty', contentHtml: '&nbsp;' };
  }

  let type = 'paragraph';
  let text = raw;

  if (raw.startsWith('### ')) {
    type = 'h3';
    text = raw.slice(4);
  } else if (raw.startsWith('## ')) {
    type = 'h2';
    text = raw.slice(3);
  } else if (raw.startsWith('# ')) {
    type = 'h1';
    text = raw.slice(2);
  } else if (raw.startsWith('- ') || raw.startsWith('* ')) {
    type = 'bullet';
    text = raw.slice(2);
  } else if (/^\d+\.\s/.test(raw)) {
    type = 'numbered';
    text = raw.replace(/^\d+\.\s/, '');
  } else if (raw.startsWith('> ')) {
    type = 'quote';
    text = raw.slice(2);
  }

  // Escape HTML characters for XSS safety
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#fff;">$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style:italic;color:var(--secondary);">$1</em>');
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:0.9em;color:var(--secondary);">$1</code>');
  // Strikethrough ~~text~~
  html = html.replace(/~~(.*?)~~/g, '<del style="opacity:0.6;">$1</del>');

  return { type, contentHtml: html };
}

interface MarkdownLiveEditorProps {
  block: NoteBlock;
  isEditing: boolean;
  onStartEdit: (initialLineIdx?: number) => void;
  onFinishEdit: () => void;
  onChangeText: (newText: string) => void;
}

const MarkdownLiveEditor: Component<MarkdownLiveEditorProps> = (props) => {
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

  const [lines, setLines] = createSignal<string[]>(['']);
  const [activeLineIndex, setActiveLineIndex] = createSignal<number>(0);

  // Sync internal lines state when block changes
  createEffect(() => {
    const raw = getRaw();
    const split = raw.split('\n');
    setLines(split.length > 0 ? split : ['']);
  });

  const updateLine = (index: number, val: string) => {
    const updated = [...lines()];
    updated[index] = val;
    setLines(updated);
    props.onChangeText(updated.join('\n'));
  };

  const handleLineKeyDown = (e: KeyboardEvent, index: number) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    const val = target.value;
    const selStart = target.selectionStart ?? val.length;
    const selEnd = target.selectionEnd ?? val.length;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const before = val.slice(0, selStart);
      const after = val.slice(selEnd);
      const updated = [...lines()];
      updated[index] = before;
      updated.splice(index + 1, 0, after);
      setLines(updated);
      props.onChangeText(updated.join('\n'));
      setActiveLineIndex(index + 1);
      return;
    }

    if (e.key === 'Backspace' && selStart === 0 && selEnd === 0) {
      if (index > 0) {
        e.preventDefault();
        const prevText = lines()[index - 1];
        const updated = [...lines()];
        updated[index - 1] = prevText + val;
        updated.splice(index, 1);
        setLines(updated);
        props.onChangeText(updated.join('\n'));
        setActiveLineIndex(index - 1);
      }
      return;
    }

    if (e.key === 'ArrowUp' && index > 0) {
      if (selStart === 0 || !val.includes('\n')) {
        e.preventDefault();
        setActiveLineIndex(index - 1);
      }
      return;
    }

    if (e.key === 'ArrowDown' && index < lines().length - 1) {
      if (selStart === val.length || !val.includes('\n')) {
        e.preventDefault();
        setActiveLineIndex(index + 1);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      props.onFinishEdit();
      return;
    }
  };

  const handleLinePaste = (e: ClipboardEvent, index: number) => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted && pasted.includes('\n')) {
      e.preventDefault();
      const target = e.currentTarget as HTMLTextAreaElement;
      const val = target.value;
      const selStart = target.selectionStart ?? val.length;
      const selEnd = target.selectionEnd ?? val.length;
      const before = val.slice(0, selStart);
      const after = val.slice(selEnd);

      const pasteLines = pasted.replace(/\r\n/g, '\n').split('\n');
      const firstCombined = before + pasteLines[0];
      const lastCombined = pasteLines[pasteLines.length - 1] + after;
      const middleLines = pasteLines.slice(1, -1);

      const inserted = [firstCombined, ...middleLines, lastCombined];
      const updated = [...lines()];
      updated.splice(index, 1, ...inserted);
      setLines(updated);
      props.onChangeText(updated.join('\n'));
      setActiveLineIndex(index + inserted.length - 1);
    }
  };

  const autoResizeTextarea = (el: HTMLTextAreaElement | undefined) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  };

  const placeholderText = () => {
    switch (props.block.type) {
      case 'shape': return 'Double-click to label group...';
      case 'text': return 'Double-click to type text...';
      case 'sticky': return 'Double-click to write note...';
      default: return 'Double-click to write (# heading, - list)...';
    }
  };

  const isBlank = () => lines().every(l => !l.trim());

  return (
    <div 
      class="canvas-markdown-body"
      onDblClick={(e) => {
        e.stopPropagation();
        if (!props.isEditing) {
          props.onStartEdit(0);
          setActiveLineIndex(0);
        }
      }}
    >
      <Show 
        when={!isBlank() || props.isEditing}
        fallback={
          <div class="md-empty-placeholder">
            {placeholderText()}
          </div>
        }
      >
        <For each={lines()}>
          {(lineText, idx) => {
            const isCurrent = () => props.isEditing && activeLineIndex() === idx();

            return (
              <Show
                when={isCurrent()}
                fallback={
                  <div
                    class="md-line-preview"
                    onClick={(e) => {
                      if (props.isEditing) {
                        e.stopPropagation();
                        setActiveLineIndex(idx());
                      }
                    }}
                    onDblClick={(e) => {
                      e.stopPropagation();
                      props.onStartEdit(idx());
                      setActiveLineIndex(idx());
                    }}
                  >
                    {(() => {
                      const rendered = renderMarkdownLine(lineText);
                      switch (rendered.type) {
                        case 'h1':
                          return <div class="md-line-h1" innerHTML={rendered.contentHtml} />;
                        case 'h2':
                          return <div class="md-line-h2" innerHTML={rendered.contentHtml} />;
                        case 'h3':
                          return <div class="md-line-h3" innerHTML={rendered.contentHtml} />;
                        case 'bullet':
                          return (
                            <div class="md-line-bullet">
                              <span class="md-bullet-symbol">•</span>
                              <span innerHTML={rendered.contentHtml} />
                            </div>
                          );
                        case 'numbered':
                          return (
                            <div class="md-line-numbered">
                              <span class="md-number-symbol">1.</span>
                              <span innerHTML={rendered.contentHtml} />
                            </div>
                          );
                        case 'quote':
                          return <div class="md-line-quote" innerHTML={rendered.contentHtml} />;
                        case 'empty':
                          return <div style={{ height: '14px' }}>&nbsp;</div>;
                        default:
                          return <div class="md-line-p" innerHTML={rendered.contentHtml} />;
                      }
                    })()}
                  </div>
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
                  rows={1}
                  class={`md-line-input ${lineText.startsWith('# ') ? 'is-h1' : lineText.startsWith('## ') ? 'is-h2' : lineText.startsWith('### ') ? 'is-h3' : ''}`}
                  value={lineText}
                  onInput={(e) => {
                    updateLine(idx(), e.currentTarget.value);
                    autoResizeTextarea(e.currentTarget);
                  }}
                  onKeyDown={(e) => handleLineKeyDown(e, idx())}
                  onPaste={(e) => handleLinePaste(e, idx())}
                  onBlur={() => {
                    setTimeout(() => {
                      const active = document.activeElement;
                      if (!active || !active.classList.contains('md-line-input')) {
                        props.onFinishEdit();
                      }
                    }, 120);
                  }}
                  placeholder="Type line (# heading, - list, etc.)..."
                />
              </Show>
            );
          }}
        </For>
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
  const [selectedBlockId, setSelectedBlockId] = createSignal<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = createSignal<string[]>([]);
  const [editingBlockId, setEditingBlockId] = createSignal<string | null>(null);
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
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectionBox(null);
      isSelectingArea = false;
      setEditingBlockId(null);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedBlockIds().length > 0 || selectedBlockId())) {
      e.preventDefault();
      const idsToDelete = selectedBlockIds().length > 0 ? [...selectedBlockIds()] : [selectedBlockId()!];
      for (const id of idsToDelete) {
        handleDeleteBlock(id);
      }
      setSelectedBlockIds([]);
      setSelectedBlockId(null);
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

  // Global mouse move for Dragging & Panning & Marquee
  const handleGlobalMouseMove = (e: MouseEvent) => {
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
        const bw = b.width || 310;
        const bh = b.height || (b.type === 'shape' ? 280 : b.type === 'text' ? 65 : 170);

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

    if (isSelectingArea) {
      isSelectingArea = false;
      setSelectionBox(null);
    }

    if (draggingBlockState) {
      const movedPositions = draggingBlockState.initialPositions;
      draggingBlockState = null;

      // Persist updated positions for all moved blocks
      const currentBlocks = blocks();
      for (const initial of movedPositions) {
        const b = currentBlocks.find(item => item.id === initial.id);
        if (b && (b.pos_x !== initial.x || b.pos_y !== initial.y)) {
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
      card: { text: '' },
      sticky: { text: '', color: '#44e1de' },
      text: { text: '' },
      shape: { text: '' },
      image: { text: '' },
      task_embed: { text: '' }
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
        content: defaultContent[type] || { text: '' }
      });

      setBlocks([...blocks(), created]);
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to create block:', err);
    }
  };

  // Inline update of block markdown text
  const handleUpdateBlockText = async (block: NoteBlock, newText: string) => {
    const updatedContent = { text: newText };

    // Update local state immediately
    setBlocks(blocks().map(b => b.id === block.id ? { ...b, content: updatedContent } : b));

    // Save to database
    try {
      await api.updateNoteBlock(block.id, { content: updatedContent });
    } catch (err) {
      console.error('Failed to save block text:', err);
    }
  };

  // Delete a block from canvas and database
  const handleDeleteBlock = async (blockId: string) => {
    setBlocks(blocks().filter(b => b.id !== blockId));
    setConnections(connections().filter(c => c.fromId !== blockId && c.toId !== blockId));
    if (selectedBlockId() === blockId) setSelectedBlockId(null);
    setSelectedBlockIds(selectedBlockIds().filter(id => id !== blockId));

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
                    const width = tool === 'text' ? 240 : tool === 'shape' ? 440 : 310;
                    const height = tool === 'shape' ? 280 : tool === 'text' ? 65 : 210;
                    const isSticky = tool === 'sticky';
                    const isShape = tool === 'shape';
                    const isText = tool === 'text';

                    return (
                      <div
                        class="canvas-ghost-preview"
                        style={{
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          border: isSticky 
                            ? '2px dashed #44e1de' 
                            : isShape 
                            ? '2px dashed #10b981' 
                            : isText 
                            ? '1px dashed rgba(255,255,255,0.6)' 
                            : '2px dashed var(--secondary)',
                          background: isSticky 
                            ? 'rgba(68, 225, 222, 0.08)' 
                            : isShape 
                            ? 'rgba(16, 185, 129, 0.05)' 
                            : isText 
                            ? 'rgba(255, 255, 255, 0.04)' 
                            : 'rgba(68, 225, 222, 0.06)',
                          "border-radius": isShape ? '12px' : isSticky ? '4px' : '8px',
                          "clip-path": isSticky ? 'polygon(0px 0px, calc(100% - 16px) 0px, 100% 16px, 100% 100%, 0px 100%)' : undefined,
                          "backdrop-filter": 'blur(4px)',
                          "box-shadow": isSticky
                            ? '0 16px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(68, 225, 222, 0.2)'
                            : isShape
                            ? '0 16px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.15)'
                            : '0 16px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(68, 225, 222, 0.15)'
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
                        case 'shape': return 'canvas-block-shape';
                        default: return 'canvas-block-card';
                      }
                    };

                    return (
                      <div
                        onMouseDown={(e) => handleBlockMouseDown(e, block)}
                        onDblClick={(e) => {
                          e.stopPropagation();
                          setEditingBlockId(block.id);
                          setSelectedBlockId(block.id);
                          setSelectedBlockIds([block.id]);
                        }}
                        class={`canvas-block ${blockTypeClass()} ${isSelected() ? 'selected' : ''}`}
                        style={{
                          left: `${block.pos_x}px`,
                          top: `${block.pos_y}px`,
                          width: `${block.width || 310}px`,
                          height: block.height ? `${block.height}px` : 'auto',
                          "min-height": block.type === 'text' ? '42px' : block.type === 'shape' ? '280px' : '150px',
                          outline: isConnectingSource() ? '2px dashed var(--secondary)' : undefined
                        }}
                      >
                        <MarkdownLiveEditor
                          block={block}
                          isEditing={editingBlockId() === block.id}
                          onStartEdit={() => {
                            setEditingBlockId(block.id);
                            setSelectedBlockId(block.id);
                            setSelectedBlockIds([block.id]);
                          }}
                          onFinishEdit={() => setEditingBlockId(null)}
                          onChangeText={(newText) => handleUpdateBlockText(block, newText)}
                        />
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

                {/* Add Shape Container */}
                <button 
                  class={`tool-btn ${activeCanvasTool() === 'shape' ? 'active' : ''}`}
                  onClick={() => setActiveCanvasTool(activeCanvasTool() === 'shape' ? 'select' : 'shape')}
                >
                  <Square size={15} />
                  <span class="tool-tooltip">
                    Shape Frame <span class="tool-tooltip-kbd">R</span>
                  </span>
                </button>

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
