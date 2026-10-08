import { persistCanvasAction } from './canvasHistory';
import { createRequestGate } from '../../services/requestGate';
import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { NoteBlock, NoteBoard, Document as OrcaDoc, Project, Space, Task } from '../../services/api';
import { api } from '../../services/api';
import { getCurrentUser } from '../../services/user';
import type { CanvasAction, Connection, ShapeKind } from './canvas';
import type { ProjectsViewProps } from './types';
export function useProjectController(props: ProjectsViewProps) {

  const [operationError, setOperationError] = createSignal('');
  const [historyBusy, setHistoryBusy] = createSignal(false);

  // Projects & Spaces from Backend
  const [projects, setProjects] = createSignal<Project[]>([]);

  const [spaces, setSpaces] = createSignal<Space[]>([]);

  const [loadingProjects, setLoadingProjects] = createSignal(true);

  // Active Project & Tab state
  const [selectedProjectId, setSelectedProjectId] = createSignal<string | null>(null);

  const [activeTab, setActiveTab] = createSignal<'docs' | 'board' | 'tasks'>('board');

  const [taskViewMode, setTaskViewMode] = createSignal<'kanban' | 'list'>('kanban');

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = createSignal(false);

  // Sub-entity states for active project
  const [docs, setDocs] = createSignal<OrcaDoc[]>([]);

  const [selectedDocId, setSelectedDocId] = createSignal<string | null>(null);

  const [boards, setBoards] = createSignal<NoteBoard[]>([]);

  const [selectedBoardId, setSelectedBoardId] = createSignal<string | null>(null);

  const [isBoardCanvasOpen, setIsBoardCanvasOpen] = createSignal(false);

  const [isCreatingBoard, setIsCreatingBoard] = createSignal(false);

  const [newBoardTitle, setNewBoardTitle] = createSignal('');

  const [blocks, setBlocks] = createSignal<NoteBlock[]>([]);

  const [tasks, setTasks] = createSignal<Task[]>([]);

  const [loadingSubData, setLoadingSubData] = createSignal(false);

  // Task Modal & Drag state
  const [isTaskModalOpen, setIsTaskModalOpen] = createSignal(false);

  const [taskToEdit, setTaskToEdit] = createSignal<Task | null>(null);

  const [defaultTaskCol, setDefaultTaskCol] = createSignal<Task['status']>('todo');

  const [draggedTaskId, setDraggedTaskId] = createSignal<string | null>(null);

  const [dragOverCol, setDragOverCol] = createSignal<Task['status'] | null>(null);

  // Document Editor & Import/Export state
  const [editingDocTitle, setEditingDocTitle] = createSignal('');

  const [editingDocContent, setEditingDocContent] = createSignal('');

  const [docViewMode, setDocViewMode] = createSignal<'edit' | 'preview'>('edit');

  const [isSavingDoc, setIsSavingDoc] = createSignal(false);

  // Canvas Viewport & Tool state
  const [zoom, setZoom] = createSignal(100);

  const [pan, setPan] = createSignal({ x: 0, y: 0 });

  const [activeCanvasTool, setActiveCanvasTool] = createSignal<'select' | 'pan' | 'card' | 'sticky' | 'text' | 'shape' | 'connector'>('select');

  const [selectedShapeKind, setSelectedShapeKind] = createSignal<ShapeKind>(
    (localStorage.getItem('orca_last_shape_kind') as ShapeKind) || 'rectangle'
  );

  const [showShapePicker, setShowShapePicker] = createSignal(false);

  const [isUploadingCanvasImage, setIsUploadingCanvasImage] = createSignal(false);

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

  // Mouse interaction states
  let isPanningCanvas = false;

  let panStart = { x: 0, y: 0 };

  let initialPan = { x: 0, y: 0 };

  let isSelectingArea = false;

  let selectionStartWorld = { x: 0, y: 0 };

  interface SnapGuide {
    type: 'vertical' | 'horizontal';
    pos: number;
    start: number;
    end: number;
  }

  const [snapGuides, setSnapGuides] = createSignal<SnapGuide[]>([]);

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

  const [hoveredConnection, setHoveredConnection] = createSignal<Connection | null>(null);

  // Dragging connection endpoints (reconnecting arrows)
  let draggingEndpointState: {
    conn: Connection;
    which: 'start' | 'end';
    startClientX: number;
    startClientY: number;
    didDrag: boolean;
  } | null = null;

  const [activeEndpointDrag, setActiveEndpointDrag] = createSignal<{
    conn: Connection;
    which: 'start' | 'end';
    worldPos: { x: number; y: number };
    targetBlockId: string | null;
    targetSide: 'top' | 'right' | 'bottom' | 'left' | null;
  } | null>(null);

  const [blockDomHeights, setBlockDomHeights] = createSignal<Record<string, number>>({});

  const getBlockWidth = (b: NoteBlock): number => {
    if (b.width && b.width > 0) return b.width;
    if (b.type === 'text') return 240;
    if (b.type === 'sticky') return 240;
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
    if (b.type === 'sticky') return 130;
    return b.type === 'text' ? 36 : 74;
  };

  // Synchronized Project & Space loader with cancellation / request sequence protection
  const projectRequests = createRequestGate();

  const loadProjectsForSpace = async (spaceId?: string | null, targetProjectId?: string | null) => {
    const reqId = projectRequests.begin();
    setLoadingProjects(true);
    setProjects([]); // Clear immediately so stale projects from other spaces are never displayed

    if (!targetProjectId) {
      setSelectedProjectId(null);
    }

    try {
      const [fetchedProjects, fetchedSpaces] = await Promise.all([
        api.getProjects(spaceId || undefined),
        spaces().length === 0 ? api.getSpaces() : Promise.resolve(spaces())
      ]);

      if (!projectRequests.isCurrent(reqId)) return; // Discard stale out-of-order response

      setProjects(fetchedProjects || []);
      if (fetchedSpaces && fetchedSpaces.length > 0) {
        setSpaces(fetchedSpaces);
      }

      if (targetProjectId && fetchedProjects && fetchedProjects.some(p => p.id === targetProjectId)) {
        setSelectedProjectId(targetProjectId);
        setActiveTab('board');
      } else {
        setSelectedProjectId(null);
      }
    } catch (err) {
      if (projectRequests.isCurrent(reqId)) {
        console.error('Failed to load projects:', err);
        setOperationError(err instanceof Error ? err.message : 'Operation failed');
      }
    } finally {
      if (projectRequests.isCurrent(reqId)) {
        setLoadingProjects(false);
      }
    }
  };

  const loadProjects = () => {
    loadProjectsForSpace(props.activeSpaceId, props.activeProjectId || selectedProjectId());
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
    if (activeTab() !== 'board' || !isBoardCanvasOpen()) return;
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
      setSnapGuides([]);
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
    if (activeTab() !== 'board' || !isBoardCanvasOpen()) return;
    if (e.code === 'Space') {
      setIsSpacePressed(false);
      isPanningCanvas = false;
    }
  };

  // Synchronized reactive loader when space or project navigation props change
  createEffect(() => {
    const spaceId = props.activeSpaceId;
    const projId = props.activeProjectId;
    loadProjectsForSpace(spaceId, projId);
  });

  // Track sub-data request ID to eliminate async race conditions
  const detailRequests = createRequestGate();
  const boardRequests = createRequestGate();
  const captureProjectSelection = () => {
    const request = detailRequests.capture();
    return () => detailRequests.isCurrent(request);
  };
  const captureBoardSelection = () => {
    const boardId = currentBoard()?.id;
    const request = boardRequests.capture();
    const projectIsCurrent = captureProjectSelection();
    return () => projectIsCurrent() && boardRequests.isCurrent(request) && currentBoard()?.id === boardId;
  };
  onCleanup(() => { projectRequests.invalidate(); detailRequests.invalidate(); boardRequests.invalidate(); });

  // Load Project Detail sub-entities when selectedProjectId changes
  createEffect(async () => {
    const pId = selectedProjectId();
    const reqId = detailRequests.begin();
    boardRequests.invalidate();
    setIsSavingDoc(false);
    setOperationError('');
    setIsBoardCanvasOpen(false);
    setSelectedBlockId(null);
    setSelectedBlockIds([]);
    setSelectedConnection(null);
    setUndoStack([]);
    setRedoStack([]);

    if (!pId) {
      setDocs([]);
      setSelectedDocId(null);
      setBoards([]);
      setSelectedBoardId(null);
      setBlocks([]);
      setConnections([]);
      setTasks([]);
      setLoadingSubData(false);
      return;
    }

    // Direct into project's board view
    setActiveTab('board');
    setLoadingSubData(true);
    setDocs([]);
    setSelectedDocId(null);
    setBoards([]);
    setSelectedBoardId(null);
    setBlocks([]);
    setConnections([]);
    setTasks([]);

    try {
      const [fetchedDocs, fetchedBoards, fetchedTasks] = await Promise.all([
        api.getDocuments({ project_id: pId }),
        api.getBoards({ project_id: pId }),
        api.getTasks({ project_id: pId })
      ]);

      if (!detailRequests.isCurrent(reqId)) return;

      setDocs(fetchedDocs || []);
      setSelectedDocId(fetchedDocs && fetchedDocs.length > 0 ? fetchedDocs[0].id : null);

      let currentBoards = fetchedBoards || [];
      // Auto-provision initial board if project has no board yet
      if (currentBoards.length === 0) {
        const curProj = projects().find(p => p.id === pId);
        const targetSpaceId = curProj?.space_id || props.activeSpaceId;
        try {
          if (!targetSpaceId) throw new Error('Project space is unavailable');
          const newBoard = await api.createBoard({
            project_id: pId,
            space_id: targetSpaceId,
            title: 'Main Board',
          });
          if (!detailRequests.isCurrent(reqId)) return;
          currentBoards = [newBoard];
        } catch (e) {
          console.error('Failed to auto-create board:', e);
          setOperationError(e instanceof Error ? e.message : 'Operation failed');
        }
        if (!detailRequests.isCurrent(reqId)) return;
      }

      setBoards(currentBoards);
      const activeBoard = (selectedBoardId() && currentBoards.some(b => b.id === selectedBoardId()))
        ? currentBoards.find(b => b.id === selectedBoardId())!
        : currentBoards[0] || null;

      setSelectedBoardId(activeBoard ? activeBoard.id : null);

      setTasks(fetchedTasks || []);
      if (activeBoard) {
        const initialBoardRequest = boardRequests.begin();
        const fetchedBlocks = await api.getBoardBlocks(activeBoard.id);
        if (!detailRequests.isCurrent(reqId) || !boardRequests.isCurrent(initialBoardRequest) || selectedBoardId() !== activeBoard.id) return;
        setBlocks(fetchedBlocks || []);
        setConnections([]);
      } else {
        setBlocks([]);
        setConnections([]);
      }

    } catch (err) {
      if (detailRequests.isCurrent(reqId)) {
        console.error('Failed to load project sub-data:', err);
        setOperationError(err instanceof Error ? err.message : 'Operation failed');
      }
    } finally {
      if (detailRequests.isCurrent(reqId)) {
        setLoadingSubData(false);
      }
    }
  });

  const currentProject = () => {
    const id = selectedProjectId();
    if (!id) return null;
    return projects().find(p => p.id === id) || null;
  };

  const currentBoard = () => {
    const id = selectedBoardId();
    if (id) {
      const found = boards().find(b => b.id === id);
      if (found) return found;
    }
    return boards()[0] || null;
  };

  const handleSelectBoard = async (boardId: string) => {
    const requestId = boardRequests.begin();
    const projectId = selectedProjectId();
    const isCurrent = () => boardRequests.isCurrent(requestId) && selectedProjectId() === projectId && selectedBoardId() === boardId;
    setSelectedBoardId(boardId);
    setBlocks([]);
    setConnections([]);
    setLoadingSubData(true);
    try {
      const fetchedBlocks = await api.getBoardBlocks(boardId);
      if (!isCurrent()) return false;
      setBlocks(fetchedBlocks || []);
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectedConnection(null);
      setUndoStack([]);
      setRedoStack([]);
      setConnections([]);
      return true;
    } catch (err) {
      if (isCurrent()) console.error('Failed to switch board:', err);
 setOperationError(err instanceof Error ? err.message : 'Operation failed');
      return false;
    } finally {
      if (isCurrent()) setLoadingSubData(false);
    }
  };

  const handleOpenBoard = async (boardId: string) => {
    if (await handleSelectBoard(boardId)) setIsBoardCanvasOpen(true);
  };

  const handleCloseBoardCanvas = () => {
    boardRequests.invalidate();
    const curId = selectedBoardId();
    if (curId) {
      setBoards(boards().map(b => b.id === curId ? { ...b, block_count: blocks().length } : b));
    }
    setIsBoardCanvasOpen(false);
  };

  const handleCreateBoard = async (title?: string) => {
    const isCurrent = captureProjectSelection();
    const proj = currentProject();
    if (!proj) return;
    const name = (title || newBoardTitle()).trim() || `Board ${boards().length + 1}`;
    try {
      const created = await api.createBoard({
        project_id: proj.id,
        space_id: proj.space_id,
        title: name,
      });
      if (!isCurrent()) return;
      const newBoard: NoteBoard = { ...created, block_count: 0 };
      setBoards([...boards(), newBoard]);
      boardRequests.invalidate();
      setSelectedBoardId(newBoard.id);
      setBlocks([]);
      setConnections([]);
      setIsCreatingBoard(false);
      setNewBoardTitle('');
      setIsBoardCanvasOpen(true);
    } catch (err) {
      console.error('Failed to create board:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleRenameBoard = async (boardId: string, newTitle: string) => {
    const isCurrent = captureProjectSelection();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      await api.updateBoard(boardId, { title: trimmed });
      if (!isCurrent()) return;
      setBoards(boards().map(b => b.id === boardId ? { ...b, title: trimmed } : b));
    } catch (err) {
      console.error('Failed to rename board:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    const isCurrent = captureProjectSelection();
    if (boards().length <= 1) {
      alert('Project minimal harus memiliki satu board.');
      return;
    }
    if (!confirm('Hapus board ini beserta seluruh isinya?')) return;
    try {
      await api.deleteBoard(boardId);
      if (!isCurrent()) return;
      const remaining = boards().filter(b => b.id !== boardId);
      setBoards(remaining);
      if (selectedBoardId() === boardId) {
        const nextBoard = remaining[0];
        if (nextBoard) {
          await handleSelectBoard(nextBoard.id);
        } else {
          setSelectedBoardId(null);
          setBlocks([]);
          setIsBoardCanvasOpen(false);
        }
      }
    } catch (err) {
      console.error('Failed to delete board:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const currentDoc = () => docs().find(d => d.id === selectedDocId()) || docs()[0];

  const getSpaceName = (spaceId?: string) => {
    if (!spaceId) return 'Workspace';
    return spaces().find(s => s.id === spaceId)?.name || 'Space';
  };

  let editingDocumentId: string | null = null;
  createEffect(() => {
    const doc = currentDoc();
    if ((doc?.id ?? null) === editingDocumentId) return;
    editingDocumentId = doc?.id ?? null;
    if (doc) {
      setEditingDocTitle(doc.title || '');
      setEditingDocContent(doc.content || '');
    } else {
      setEditingDocTitle('');
      setEditingDocContent('');
    }
  });

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
    if (historyBusy()) return;
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
      const rawX = (e.clientX - containerRect.left - pan().x) / scale;
      const rawY = (e.clientY - containerRect.top - pan().y) / scale;
      const clickX = Math.round(rawX / 24) * 24;
      const clickY = Math.round(rawY / 24) * 24;
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
    if (historyBusy()) return;
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
        const rawX = (e.clientX - containerRect.left - pan().x) / scale;
        const rawY = (e.clientY - containerRect.top - pan().y) / scale;
        const clickX = Math.round(rawX / 24) * 24;
        const clickY = Math.round(rawY / 24) * 24;
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
      case 'top': return { x: block.pos_x + w / 2, y: block.pos_y, side };
      case 'right': return { x: block.pos_x + w, y: block.pos_y + h / 2, side };
      case 'bottom': return { x: block.pos_x + w / 2, y: block.pos_y + h, side };
      case 'left': return { x: block.pos_x, y: block.pos_y + h / 2, side };
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

  // Mouse down on a connection endpoint handle (to drag & reconnect arrow)
  const handleEndpointMouseDown = (e: MouseEvent, conn: Connection, which: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    draggingEndpointState = {
      conn,
      which,
      startClientX: e.clientX,
      startClientY: e.clientY,
      didDrag: false,
    };
    setSelectedConnection(conn);
    setSelectedBlockId(null);
    setSelectedBlockIds([]);
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
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
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

      const targetBlock = blocks().find(b => b.id === blockId);
      const bType = targetBlock?.type;

      let minW = 60;
      let minH = 36;
      if (bType === 'card') {
        minW = 180;
        minH = 74;
      } else if (bType === 'sticky') {
        minW = 180;
        minH = 120;
      } else if (bType === 'text') {
        minW = 60;
        minH = 32;
      } else if (bType === 'shape') {
        minW = 60;
        minH = 36;
      }

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

      newW = Math.round(newW / 12) * 12;
      newH = Math.round(newH / 12) * 12;
      newX = Math.round(newX / 12) * 12;
      newY = Math.round(newY / 12) * 12;

      setBlocks(blocks().map(b => b.id === blockId ? {
        ...b,
        pos_x: Math.round(newX),
        pos_y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      } : b));
      return;
    }

    // 0a. Reconnecting arrow endpoint drag
    if (draggingEndpointState) {
      const dx = e.clientX - draggingEndpointState.startClientX;
      const dy = e.clientY - draggingEndpointState.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) draggingEndpointState.didDrag = true;

      if (canvasContainerRef) {
        const rect = canvasContainerRef.getBoundingClientRect();
        const scale = zoom() / 100;
        const worldX = (e.clientX - rect.left - pan().x) / scale;
        const worldY = (e.clientY - rect.top - pan().y) / scale;

        const draggingWhich = draggingEndpointState.which;
        const currentConn = draggingEndpointState.conn;
        const forbiddenBlockId = draggingWhich === 'start' ? currentConn.toId : currentConn.fromId;

        // Detect hovered target block (with 15px padding for easy snapping)
        const target = blocks().find(b => {
          if (b.id === forbiddenBlockId) return false;
          if (b.type === 'sticky') return false;
          const w = getBlockWidth(b);
          const h = getBlockHeight(b);
          const pad = 15;
          return worldX >= b.pos_x - pad && worldX <= b.pos_x + w + pad &&
            worldY >= b.pos_y - pad && worldY <= b.pos_y + h + pad;
        });

        if (target) {
          setHoveredTargetBlockId(target.id);
          const closestSide = getClosestSide(target, worldX, worldY);
          setHoveredTargetSide(closestSide);
          const snapPt = getSidePoint(target, closestSide);
          setActiveEndpointDrag({
            conn: currentConn,
            which: draggingWhich,
            worldPos: { x: snapPt.x, y: snapPt.y },
            targetBlockId: target.id,
            targetSide: closestSide,
          });
        } else {
          setHoveredTargetBlockId(null);
          setHoveredTargetSide(null);
          setActiveEndpointDrag({
            conn: currentConn,
            which: draggingWhich,
            worldPos: { x: worldX, y: worldY },
            targetBlockId: null,
            targetSide: null,
          });
        }
      }
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

    // 3. Dragging selected block(s) with Whimsical-grade Smart Alignment & Grid Snap
    if (draggingBlockState) {
      const scale = zoom() / 100;
      const rawDx = (e.clientX - draggingBlockState.startX) / scale;
      const rawDy = (e.clientY - draggingBlockState.startY) / scale;

      const leadInitial = draggingBlockState.initialPositions.find(p => p.id === draggingBlockState!.blockId)
        || draggingBlockState.initialPositions[0];
      const leadBlock = blocks().find(b => b.id === leadInitial.id);

      const leadW = leadBlock ? getBlockWidth(leadBlock) : 200;
      const leadH = leadBlock ? getBlockHeight(leadBlock) : 100;

      const rawLeadX = leadInitial.x + rawDx;
      const rawLeadY = leadInitial.y + rawDy;

      const draggedIds = new Set(draggingBlockState.initialPositions.map(p => p.id));
      const stationaryBlocks = blocks().filter(b => !draggedIds.has(b.id));

      const SNAP_DIST = 8; // magnetic threshold
      const GRID_SIZE = 12; // grid snap interval (matches 24px dot grid)

      let bestX = Math.round(rawLeadX / GRID_SIZE) * GRID_SIZE;
      let minDiffX = SNAP_DIST;
      let xGuide: SnapGuide | null = null;

      // Smart X alignment against other blocks
      for (const other of stationaryBlocks) {
        const otherW = getBlockWidth(other);
        const otherH = getBlockHeight(other);

        const otherLeft = other.pos_x;
        const otherCenter = other.pos_x + otherW / 2;
        const otherRight = other.pos_x + otherW;

        const candidates = [
          { targetX: otherLeft, guideX: otherLeft },
          { targetX: otherRight, guideX: otherRight },
          { targetX: otherCenter - leadW / 2, guideX: otherCenter },
          { targetX: otherLeft - leadW, guideX: otherLeft },
          { targetX: otherRight - leadW, guideX: otherRight }
        ];

        for (const cand of candidates) {
          const diff = Math.abs(rawLeadX - cand.targetX);
          if (diff < minDiffX) {
            minDiffX = diff;
            bestX = cand.targetX;
            xGuide = {
              type: 'vertical',
              pos: cand.guideX,
              start: Math.min(rawLeadY, other.pos_y) - 40,
              end: Math.max(rawLeadY + leadH, other.pos_y + otherH) + 40
            };
          }
        }
      }

      let bestY = Math.round(rawLeadY / GRID_SIZE) * GRID_SIZE;
      let minDiffY = SNAP_DIST;
      let yGuide: SnapGuide | null = null;

      // Smart Y alignment against other blocks
      for (const other of stationaryBlocks) {
        const otherW = getBlockWidth(other);
        const otherH = getBlockHeight(other);

        const otherTop = other.pos_y;
        const otherCenter = other.pos_y + otherH / 2;
        const otherBottom = other.pos_y + otherH;

        const candidates = [
          { targetY: otherTop, guideY: otherTop },
          { targetY: otherBottom, guideY: otherBottom },
          { targetY: otherCenter - leadH / 2, guideY: otherCenter },
          { targetY: otherTop - leadH, guideY: otherTop },
          { targetY: otherBottom - leadH, guideY: otherBottom }
        ];

        for (const cand of candidates) {
          const diff = Math.abs(rawLeadY - cand.targetY);
          if (diff < minDiffY) {
            minDiffY = diff;
            bestY = cand.targetY;
            yGuide = {
              type: 'horizontal',
              pos: cand.guideY,
              start: Math.min(rawLeadX, other.pos_x) - 40,
              end: Math.max(rawLeadX + leadW, other.pos_x + otherW) + 40
            };
          }
        }
      }

      const activeGuides: SnapGuide[] = [];
      if (xGuide) activeGuides.push(xGuide);
      if (yGuide) activeGuides.push(yGuide);
      setSnapGuides(activeGuides);

      const finalDx = bestX - leadInitial.x;
      const finalDy = bestY - leadInitial.y;

      const posMap = new Map(draggingBlockState.initialPositions.map(p => [p.id, { x: p.x + finalDx, y: p.y + finalDy }]));

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

    // 4. Track cursor position for placement ghost preview with 24px grid snap
    if (['card', 'sticky', 'text', 'shape'].includes(activeCanvasTool())) {
      const containerRect = canvasContainerRef?.getBoundingClientRect();
      if (containerRect) {
        const scale = zoom() / 100;
        const rawX = (e.clientX - containerRect.left - pan().x) / scale;
        const rawY = (e.clientY - containerRect.top - pan().y) / scale;
        setCursorCanvasPos({
          x: Math.round(rawX / 24) * 24,
          y: Math.round(rawY / 24) * 24
        });
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
            setOperationError(err instanceof Error ? err.message : 'Operation failed');
          }
        }
      }
      return;
    }

    // Finalize reconnecting arrow endpoint drag
    if (draggingEndpointState) {
      const epState = draggingEndpointState;
      draggingEndpointState = null;
      const activeDrag = activeEndpointDrag();
      setActiveEndpointDrag(null);
      setHoveredTargetBlockId(null);
      setHoveredTargetSide(null);

      if (epState.didDrag && activeDrag && activeDrag.targetBlockId && activeDrag.targetSide) {
        const oldConn = epState.conn;
        const targetId = activeDrag.targetBlockId;
        const targetSide = activeDrag.targetSide;

        let newConn: Connection;
        if (epState.which === 'start') {
          newConn = {
            ...oldConn,
            fromId: targetId,
            fromSide: targetSide,
          };
        } else {
          newConn = {
            ...oldConn,
            toId: targetId,
            toSide: targetSide,
          };
        }

        // Check if identical or reverse already exists (except oldConn itself)
        const duplicate = connections().some(c => {
          if (c.fromId === oldConn.fromId && c.toId === oldConn.toId) return false;
          return (c.fromId === newConn.fromId && c.toId === newConn.toId) ||
            (c.fromId === newConn.toId && c.toId === newConn.fromId);
        });

        // Don't connect block to itself
        if (newConn.fromId !== newConn.toId && !duplicate) {
          setConnections(prev => prev.map(c =>
            (c.fromId === oldConn.fromId && c.toId === oldConn.toId) ? newConn : c
          ));
          pushUndoAction({
            type: 'update_connection',
            prevConnection: oldConn,
            newConnection: newConn,
          });
          setSelectedConnection(newConn);
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
            case 'top': newY = srcBlock.pos_y - hgt - gap; break;
            case 'right': newX = srcBlock.pos_x + w + gap; break;
            case 'bottom': newY = srcBlock.pos_y + hgt + gap; break;
            case 'left': newX = srcBlock.pos_x - w - gap; break;
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
      setSnapGuides([]);
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
            setOperationError(err instanceof Error ? err.message : 'Operation failed');
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
    if (historyBusy()) return;
    const isCurrent = captureBoardSelection();
    const board = currentBoard();
    if (!board) return;
    const type = srcBlock.type;
    const width = srcBlock.width || getBlockWidth(srcBlock);
    const user = getCurrentUser();
    const authorData = {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
    };
    const defaultContent = type === 'shape'
      ? { text: '', shape_kind: srcBlock.content?.shape_kind || 'rectangle' }
      : type === 'sticky'
        ? { text: '', color: 'var(--text-main)', author: authorData }
        : { text: '' };
    try {
      const created = await api.createNoteBlock(board.id, {
        type,
        pos_x: Math.round(newX),
        pos_y: Math.round(newY),
        width,
        content: defaultContent,
      });
      if (!isCurrent()) return;
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
      if (isCurrent()) setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  // Create a new block at coordinates or viewport center
  const handleCreateBlock = async (type: NoteBlock['type'] = 'card', posX?: number, posY?: number) => {
    if (historyBusy()) return;
    const isCurrent = captureBoardSelection();
    const board = currentBoard();
    if (!board) {
      console.warn('No active board found to attach block.');
      return;
    }

    const scale = zoom() / 100;
    // If coordinates not provided, drop at visible canvas center snapped to grid
    const rawX = posX !== undefined ? posX : (-pan().x + 360) / scale + (blocks().length * 24) % 120;
    const rawY = posY !== undefined ? posY : (-pan().y + 180) / scale + (blocks().length * 24) % 120;
    const x = Math.round(rawX / 24) * 24;
    const y = Math.round(rawY / 24) * 24;

    const user = getCurrentUser();
    const authorData = {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
    };

    const defaultShapeKind = selectedShapeKind();
    const defaultContent = {
      card: { text: '' },
      sticky: { text: '', color: 'var(--text-main)', author: authorData },
      text: { text: '' },
      shape: { text: '', shape_kind: defaultShapeKind },
      image: { text: '' },
      task_embed: { text: '' }
    };

    let width = 310;
    if (type === 'text') {
      width = 240;
    } else if (type === 'sticky') {
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
      if (!isCurrent()) return;

      pushUndoAction({
        type: 'create_block',
        block: created
      });

      setBlocks([...blocks(), created]);
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to create block:', err);
      if (isCurrent()) setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  // Upload an image to Object Storage and place it on the canvas as an image block
  const handleUploadCanvasImage = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar yang valid (JPEG, PNG, WebP, GIF)');
      return;
    }

    if (historyBusy()) return;
    const isCurrent = captureBoardSelection();
    const board = currentBoard();
    if (!board) {
      alert('Papan board tidak ditemukan');
      return;
    }

    setIsUploadingCanvasImage(true);
    try {
      const uploadRes = await api.uploadImage(file);
      if (!isCurrent()) return;
      const scale = zoom() / 100;
      const x = Math.round((-pan().x + 360) / scale + (blocks().length * 20) % 100);
      const y = Math.round((-pan().y + 180) / scale + (blocks().length * 20) % 100);

      const created = await api.createNoteBlock(board.id, {
        type: 'image',
        pos_x: x,
        pos_y: y,
        width: 320,
        content: {
          url: uploadRes.url,
          caption: file.name,
          driver: uploadRes.driver,
        },
      });
      if (!isCurrent()) return;

      pushUndoAction({ type: 'create_block', block: created });
      setBlocks(prev => [...prev, created]);
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err: any) {
      alert('Gagal mengunggah gambar ke object storage: ' + (err.message || 'Error'));
    } finally {
      setIsUploadingCanvasImage(false);
      input.value = '';
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
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
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
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  // Duplicate block with offset and full undo history support
  const handleDuplicateBlock = async (block: NoteBlock) => {
    if (historyBusy()) return;
    const isCurrent = captureBoardSelection();
    const board = currentBoard();
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
      if (!isCurrent()) return;
      setBlocks(prev => [...prev, created]);
      pushUndoAction({ type: 'create_block', block: created });
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
    } catch (err) {
      console.error('Failed to duplicate block:', err);
      if (isCurrent()) setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  // Copy block to clipboard
  const handleCopyBlock = (block: NoteBlock) => {
    setCopiedBlock(JSON.parse(JSON.stringify(block)));
    const text = typeof block.content === 'object' ? block.content?.text : block.content;
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => { });
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
    if (historyBusy()) return;
    const isCurrent = captureBoardSelection();
    const board = currentBoard();
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
      if (!isCurrent()) return;
      setBlocks(prev => [...prev, created]);
      pushUndoAction({ type: 'create_block', block: created });
      setSelectedBlockId(created.id);
      setSelectedBlockIds([created.id]);
      setCopiedBlock({ ...clip, pos_x: clip.pos_x + offset, pos_y: clip.pos_y + offset });
    } catch (err) {
      console.error('Failed to paste block:', err);
      if (isCurrent()) setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  // Delete multiple blocks with full undo history support
  const handleDeleteBlocks = async (blockIds: string[]) => {
    if (historyBusy()) return;
    const toDelete = blocks().filter(b => blockIds.includes(b.id));
    const board = currentBoard();
    if (!board || !toDelete.length) return;
    const isCurrent = captureProjectSelection();
    const idSet = new Set(blockIds);
    const action: CanvasAction = {
      type: 'delete_blocks', blocks: toDelete,
      connections: connections().filter(c => idSet.has(c.fromId) || idSet.has(c.toId)),
    };
    setHistoryBusy(true);
    try {
      await persistCanvasAction(api, action, 'redo');
      if (!isCurrent() || currentBoard()?.id !== board.id) return;
      pushUndoAction(action);
      setBlocks(prev => prev.filter(b => !idSet.has(b.id)));
      setConnections(prev => prev.filter(c => !idSet.has(c.fromId) && !idSet.has(c.toId)));
      if (selectedBlockId() && idSet.has(selectedBlockId()!)) setSelectedBlockId(null);
      setSelectedBlockIds(prev => prev.filter(id => !idSet.has(id)));
    } catch (error) {
      if (!isCurrent() || currentBoard()?.id !== board.id) return;
      setOperationError(error instanceof Error ? error.message : 'Could not delete blocks');
      // A partially completed multi-block operation remains undoable.
      pushUndoAction(action);
      try {
        const confirmed = await api.getBoardBlocks(board.id);
        if (isCurrent() && currentBoard()?.id === board.id) setBlocks(confirmed);
      } catch { /* Error remains visible and the original action remains undoable. */ }
    } finally { setHistoryBusy(false); }
  };

  // Canvas Undo Handler (Ctrl+Z)
  const handleUndo = async () => {
    const stack = undoStack();
    if (stack.length === 0 || historyBusy()) return;
    const action = stack[stack.length - 1];
    const board = currentBoard();
    const isCurrent = captureProjectSelection();
    setHistoryBusy(true);
    try {
      await persistCanvasAction(api, action, 'undo');
      if (!isCurrent() || currentBoard()?.id !== board?.id) return;
    } catch (error) {
      if (isCurrent() && currentBoard()?.id === board?.id) {
        setOperationError(error instanceof Error ? error.message : 'Could not update board history');
        if (board) {
          try {
            const confirmed = await api.getBoardBlocks(board.id);
            if (isCurrent() && currentBoard()?.id === board.id) setBlocks(confirmed);
          } catch { /* Retain last confirmed state. */ }
        }
      }
      return;
    } finally { setHistoryBusy(false); }
    setUndoStack(prev => prev.slice(0, -1));

    switch (action.type) {
      case 'create_block': {
        setBlocks(prev => prev.filter(b => b.id !== action.block.id));
        setConnections(prev => prev.filter(c => c.fromId !== action.block.id && c.toId !== action.block.id));
        if (selectedBlockId() === action.block.id) setSelectedBlockId(null);
        setSelectedBlockIds(prev => prev.filter(id => id !== action.block.id));
        break;
      }
      case 'delete_blocks': {
        setBlocks(prev => [...prev.filter(b => !action.blocks.some(restored => restored.id === b.id)), ...action.blocks]);
        if (action.connections && action.connections.length > 0) {
          setConnections(prev => [...prev.filter(c => !action.connections.some(restored => restored.fromId === c.fromId && restored.toId === c.toId)), ...action.connections]);
        }
        break;
      }
      case 'move_blocks': {
        const moveMap = new Map(action.moves.map(m => [m.id, { x: m.fromX, y: m.fromY }]));
        setBlocks(prev => prev.map(b => {
          const p = moveMap.get(b.id);
          return p ? { ...b, pos_x: p.x, pos_y: p.y } : b;
        }));

        break;
      }
      case 'update_text': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? { ...b, content: action.prevContent } : b));
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
      case 'update_connection': {
        setConnections(prev => prev.map(c =>
          (c.fromId === action.newConnection.fromId && c.toId === action.newConnection.toId)
            ? action.prevConnection
            : c
        ));
        setSelectedConnection(action.prevConnection);
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
        break;
      }
    }

    setRedoStack(prev => [...prev, action]);
  };

  // Canvas Redo Handler (Ctrl+Y or Ctrl+Shift+Z)
  const handleRedo = async () => {
    const stack = redoStack();
    if (stack.length === 0 || historyBusy()) return;
    const action = stack[stack.length - 1];
    const board = currentBoard();
    const isCurrent = captureProjectSelection();
    setHistoryBusy(true);
    try {
      await persistCanvasAction(api, action, 'redo');
      if (!isCurrent() || currentBoard()?.id !== board?.id) return;
    } catch (error) {
      if (isCurrent() && currentBoard()?.id === board?.id) {
        setOperationError(error instanceof Error ? error.message : 'Could not update board history');
        if (board) {
          try {
            const confirmed = await api.getBoardBlocks(board.id);
            if (isCurrent() && currentBoard()?.id === board.id) setBlocks(confirmed);
          } catch { /* Retain last confirmed state. */ }
        }
      }
      return;
    } finally { setHistoryBusy(false); }
    setRedoStack(prev => prev.slice(0, -1));

    switch (action.type) {
      case 'create_block': {
        setBlocks(prev => [...prev.filter(b => b.id !== action.block.id), action.block]);

        break;
      }
      case 'delete_blocks': {
        const idSet = new Set(action.blocks.map(b => b.id));
        setBlocks(prev => prev.filter(b => !idSet.has(b.id)));
        setConnections(prev => prev.filter(c => !idSet.has(c.fromId) && !idSet.has(c.toId)));
        if (selectedBlockId() && idSet.has(selectedBlockId()!)) setSelectedBlockId(null);
        setSelectedBlockIds(prev => prev.filter(id => !idSet.has(id)));

        break;
      }
      case 'move_blocks': {
        const moveMap = new Map(action.moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
        setBlocks(prev => prev.map(b => {
          const p = moveMap.get(b.id);
          return p ? { ...b, pos_x: p.x, pos_y: p.y } : b;
        }));

        break;
      }
      case 'update_text': {
        setBlocks(prev => prev.map(b => b.id === action.blockId ? { ...b, content: action.newContent } : b));
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
      case 'update_connection': {
        setConnections(prev => prev.map(c =>
          (c.fromId === action.prevConnection.fromId && c.toId === action.prevConnection.toId)
            ? action.newConnection
            : c
        ));
        setSelectedConnection(action.newConnection);
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
      else return { x: block.pos_x, y: cy, side: 'left' };
    } else {
      if (dy > 0) return { x: cx, y: block.pos_y + h, side: 'bottom' };
      else return { x: cx, y: block.pos_y, side: 'top' };
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

      const activeDrag = activeEndpointDrag();
      const isDraggingThisStart = activeDrag && activeDrag.conn.fromId === conn.fromId && activeDrag.conn.toId === conn.toId && activeDrag.which === 'start';
      const isDraggingThisEnd = activeDrag && activeDrag.conn.fromId === conn.fromId && activeDrag.conn.toId === conn.toId && activeDrag.which === 'end';

      const cx2 = b2.pos_x + getBlockWidth(b2) / 2;
      const cy2 = b2.pos_y + getBlockHeight(b2) / 2;

      // Exit point on b1
      let p1 = conn.fromSide
        ? getSidePoint(b1, conn.fromSide)
        : getBestAttachPoint(b1, cx2, cy2);

      // Entry point on b2
      let p2 = conn.toSide
        ? getSidePoint(b2, conn.toSide)
        : getBestAttachPoint(b2, p1.x, p1.y);

      if (isDraggingThisStart && activeDrag) {
        p1 = { x: activeDrag.worldPos.x, y: activeDrag.worldPos.y, side: (activeDrag.targetSide || p1.side) as any };
      }
      if (isDraggingThisEnd && activeDrag) {
        p2 = { x: activeDrag.worldPos.x, y: activeDrag.worldPos.y, side: (activeDrag.targetSide || p2.side) as any };
      }

      // Build bezier control points perpendicular to each side
      const ctrlDist = Math.max(50, Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) * 0.35);
      const sideOffset = (side: string | undefined): [number, number] => {
        switch (side) {
          case 'right': return [ctrlDist, 0];
          case 'left': return [-ctrlDist, 0];
          case 'bottom': return [0, ctrlDist];
          case 'top': return [0, -ctrlDist];
          default: return [0, 0];
        }
      };
      const [c1dx, c1dy] = (isDraggingThisStart && !activeDrag?.targetSide) ? [0, 0] : sideOffset(p1.side);
      const [c2dx, c2dy] = (isDraggingThisEnd && !activeDrag?.targetSide) ? [0, 0] : sideOffset(p2.side);
      const pathData = `M ${p1.x} ${p1.y} C ${p1.x + c1dx} ${p1.y + c1dy}, ${p2.x + c2dx} ${p2.y + c2dy}, ${p2.x} ${p2.y}`;

      const isSelected = selectedConnection() && selectedConnection()?.fromId === conn.fromId && selectedConnection()?.toId === conn.toId;
      const isHovered = () => hoveredConnection() && hoveredConnection()?.fromId === conn.fromId && hoveredConnection()?.toId === conn.toId;
      const showHandles = () => isSelected || isHovered() || isDraggingThisStart || isDraggingThisEnd;

      return (
        <g
          class="connector-curve-group"
          onMouseEnter={() => setHoveredConnection(conn)}
          onMouseLeave={() => {
            if (hoveredConnection()?.fromId === conn.fromId && hoveredConnection()?.toId === conn.toId) {
              setHoveredConnection(null);
            }
          }}
        >
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
          {/* Highlight halo when selected — illuminates without changing arrow color */}
          <Show when={isSelected}>
            <path
              d={pathData}
              fill="none"
              stroke="var(--focus-ring)"
              stroke-width="10"
              stroke-linecap="round"
              opacity="0.25"
              style={{ "pointer-events": 'none' }}
            />
            <path
              d={pathData}
              fill="none"
              stroke="var(--focus-ring)"
              stroke-width="5"
              stroke-linecap="round"
              opacity="0.4"
              style={{ "pointer-events": 'none' }}
            />
          </Show>
          {/* Visible connector line: maintains base #3b82f6 color consistently */}
          <path
            d={pathData}
            fill="none"
            stroke="var(--focus-ring)"
            stroke-width={isSelected ? '2.4' : '1.8'}
            opacity="1"
            marker-end="url(#orca-arrowhead)"
            style={{ "pointer-events": 'none' }}
          />
          {/* Endpoint Handles: draggable circles at start (p1) and end (p2) */}
          <Show when={showHandles()}>
            {/* Start handle (p1) */}
            <g
              style={{
                cursor: isDraggingThisStart ? 'grabbing' : 'grab',
                "pointer-events": 'all',
              }}
              onMouseDown={(e) => handleEndpointMouseDown(e, conn, 'start')}
            >
              <circle cx={p1.x} cy={p1.y} r="14" fill="transparent" />
              <circle
                cx={p1.x}
                cy={p1.y}
                r={isDraggingThisStart ? '6.5' : '5'}
                fill={isDraggingThisStart ? 'var(--focus-ring)' : 'var(--surface-panel)'}
                stroke={isDraggingThisStart ? 'var(--surface-panel)' : 'var(--focus-ring)'}
                stroke-width="2.5"
                style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))' }}
              />
            </g>
            {/* End handle (p2) */}
            <g
              style={{
                cursor: isDraggingThisEnd ? 'grabbing' : 'grab',
                "pointer-events": 'all',
              }}
              onMouseDown={(e) => handleEndpointMouseDown(e, conn, 'end')}
            >
              <circle cx={p2.x} cy={p2.y} r="14" fill="transparent" />
              <circle
                cx={p2.x}
                cy={p2.y}
                r={isDraggingThisEnd ? '6.5' : '5'}
                fill={isDraggingThisEnd ? 'var(--focus-ring)' : 'var(--surface-panel)'}
                stroke={isDraggingThisEnd ? 'var(--surface-panel)' : 'var(--focus-ring)'}
                stroke-width="2.5"
                style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))' }}
              />
            </g>
          </Show>
          {/* Delete pill button on selected connection */}
          <Show when={isSelected && !isDraggingThisStart && !isDraggingThisEnd}>
            {(() => {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              return (
                <foreignObject
                  x={midX - 11}
                  y={midY - 11}
                  width="22"
                  height="22"
                  style={{ overflow: 'visible', "pointer-events": 'all' }}
                >
                  <button
                    title="Delete connection"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConnection(conn);
                    }}
                    style={{
                      width: '22px',
                      height: '22px',
                      "border-radius": '50%',
                      background: 'var(--status-error)',
                      border: '2px solid var(--surface)',
                      color: '#ffffff',
                      display: 'flex',
                      "align-items": 'center',
                      "justify-content": 'center',
                      cursor: 'pointer',
                      padding: 0,
                      "font-size": '12px',
                      "font-weight": 'bold',
                      "box-shadow": 'none'
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
            { side: 'top', cx: block.pos_x + w / 2, cy: block.pos_y },
            { side: 'right', cx: block.pos_x + w, cy: block.pos_y + h / 2 },
            { side: 'bottom', cx: block.pos_x + w / 2, cy: block.pos_y + h },
            { side: 'left', cx: block.pos_x, cy: block.pos_y + h / 2 },
          ] : [];

          const resizeCorners: Array<{ corner: 'nw' | 'ne' | 'se' | 'sw'; cx: number; cy: number; cursor: string }> = [
            { corner: 'nw', cx: block.pos_x, cy: block.pos_y, cursor: 'nwse-resize' },
            { corner: 'ne', cx: block.pos_x + w, cy: block.pos_y, cursor: 'nesw-resize' },
            { corner: 'se', cx: block.pos_x + w, cy: block.pos_y + h, cursor: 'nwse-resize' },
            { corner: 'sw', cx: block.pos_x, cy: block.pos_y + h, cursor: 'nesw-resize' },
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

  // -------------------------------------------------------------
  // TASKS & DOCS TAB HANDLERS
  // -------------------------------------------------------------

  const handleOpenNewTaskModal = (status?: Task['status']) => {
    setTaskToEdit(null);
    setDefaultTaskCol(status || 'todo');
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskSaved = (saved: Task) => {
    const existing = tasks().find(t => t.id === saved.id);
    if (existing) {
      setTasks(tasks().map(t => t.id === saved.id ? saved : t));
    } else {
      setTasks([...tasks(), saved]);
    }
  };

  const handleTaskDeleted = (deletedId: string) => {
    setTasks(tasks().filter(t => t.id !== deletedId));
  };

  const handleTaskDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const handleColDragOver = (e: DragEvent, colKey: Task['status']) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverCol(colKey);
  };

  const handleColDragLeave = (colKey: Task['status']) => {
    if (dragOverCol() === colKey) {
      setDragOverCol(null);
    }
  };

  const handleColDrop = async (e: DragEvent, colKey: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer?.getData('text/plain') || draggedTaskId();
    setDragOverCol(null);
    setDraggedTaskId(null);
    if (!taskId) return;
    const currentTask = tasks().find(t => t.id === taskId);
    if (!currentTask || currentTask.status === colKey) return;

    // Optimistic update
    setTasks(tasks().map(t => t.id === taskId ? { ...t, status: colKey } : t));
    try {
      await api.updateTaskStatus(taskId, colKey);
    } catch (err) {
      console.error('Failed to update task status:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
      // Revert on error
      setTasks(tasks().map(t => t.id === taskId ? currentTask : t));
    }
  };

  const handleCreateNewDoc = async () => {
    const isCurrent = captureProjectSelection();
    const proj = currentProject();
    if (!proj) return;

    try {
      const newDoc = await api.createDocument({
        project_id: proj.id,
        space_id: proj.space_id,
        title: `Document ${docs().length + 1}`,
        doc_type: 'notes',
        content: '',
        is_pinned: false
      });
      if (!isCurrent()) return;
      setDocs([newDoc, ...docs()]);
      setSelectedDocId(newDoc.id);
      setEditingDocTitle(newDoc.title);
      setEditingDocContent('');
      setDocViewMode('edit');
    } catch (err) {
      console.error('Failed to create document:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleSaveDoc = async () => {
    if (isSavingDoc()) return;
    const isCurrent = captureProjectSelection();
    const doc = currentDoc();
    if (!doc) return;
    const title = editingDocTitle().trim() || 'Untitled Document';
    const content = editingDocContent();
    setIsSavingDoc(true);
    try {
      const updated = await api.updateDocument(doc.id, { title, content, expected_updated_at: doc.updated_at });
      if (!isCurrent()) return;
      setDocs(docs().map(d => d.id === doc.id ? updated : d));
    } catch (err) {
      console.error('Failed to save document:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      if (isCurrent()) setIsSavingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId?: string) => {
    const isCurrent = captureProjectSelection();
    const idToDelete = docId || selectedDocId();
    if (!idToDelete) return;
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(idToDelete);
      if (!isCurrent()) return;
      const remaining = docs().filter(d => d.id !== idToDelete);
      setDocs(remaining);
      setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
    } catch (err) {
      console.error('Failed to delete document:', err);
      setOperationError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleDownloadDoc = () => {
    const doc = currentDoc();
    if (!doc) return;
    const filename = `${(editingDocTitle() || 'document').replace(/[^a-zA-Z0-9_\-]/g, '_')}.md`;
    const blob = new Blob([editingDocContent()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportDoc = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const proj = currentProject();
    const isCurrent = captureProjectSelection();
    if (!proj) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = (event.target?.result as string) || '';
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      if (!isCurrent()) return;
      try {
        const created = await api.createDocument({
          project_id: proj.id,
          space_id: proj.space_id,
          title: rawName,
          doc_type: 'notes',
          content: text,
          is_pinned: false
        });
        if (!isCurrent()) return;
        setDocs([created, ...docs()]);
        setSelectedDocId(created.id);
        setEditingDocTitle(created.title);
        setEditingDocContent(created.content);
      } catch (err) {
        console.error('Failed to import document:', err);
        setOperationError(err instanceof Error ? err.message : 'Operation failed');
      }
    };
    reader.readAsText(file);
    input.value = '';
  };
  return {
    operationError, setOperationError, historyBusy,
setSelectedProjectId,
    selectedProjectId,
    currentProject,
    activeTab,
    setActiveTab,
    docs,
    boards,
    tasks,
    loadProjects,
    handleImportDoc,
    handleCreateNewDoc,
    loadingSubData,
    setSelectedDocId,
    selectedDocId,
    handleDeleteDoc,
    currentDoc,
    editingDocTitle,
    setEditingDocTitle,
    handleSaveDoc,
    setDocViewMode,
    docViewMode,
    handleDownloadDoc,
    isSavingDoc,
    editingDocContent,
    setEditingDocContent,
    isBoardCanvasOpen,
    setNewBoardTitle,
    setIsCreatingBoard,
    isCreatingBoard,
    newBoardTitle,
    handleCreateBoard,
    handleOpenBoard,
    handleRenameBoard,
    handleDeleteBoard,
    get canvasContainerRef() { return canvasContainerRef; }, set canvasContainerRef(value: typeof canvasContainerRef) { canvasContainerRef = value; },
    handleCanvasWheel,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
    handleCanvasMouseDown,
    setCursorCanvasPos,
    setSnapGuides,
    isActivelyPanning,
    get isSelectingArea() { return isSelectingArea; }, set isSelectingArea(value: typeof isSelectingArea) { isSelectingArea = value; },
    activeCanvasTool,
    isSpacePressed,
    handleCloseBoardCanvas,
    currentBoard,
    blocks,
    pan,
    zoom,
    renderConnectorCurves,
    snapGuides,
    dragArrowStart,
    dragArrowEnd,
    selectionBox,
    cursorCanvasPos,
    selectedShapeKind,
    selectedBlockIds,
    selectedBlockId,
    connectingSourceId,
    blockDomHeights,
    setBlockDomHeights,
    handleBlockMouseDown,
    setEditingBlockId,
    setSelectedBlockId,
    setSelectedBlockIds,
    hoveredTargetBlockId,
    getBlockWidth,
    editingBlockId,
    handleFinishBlockEdit,
    renderCanvasHandles,
    primarySelectedBlock,
    get draggingBlockState() { return draggingBlockState; }, set draggingBlockState(value: typeof draggingBlockState) { draggingBlockState = value; },
    get resizingBlockState() { return resizingBlockState; }, set resizingBlockState(value: typeof resizingBlockState) { resizingBlockState = value; },
    handleCopyBlock, handleCutBlock, handleDeleteBlocks, handleDuplicateBlock, handleUpdateBlockContent,
    showContextColorPicker, setShowContextColorPicker,
    showContextMoreMenu, setShowContextMoreMenu,
    setActiveCanvasTool,
    undoStack,
    handleUndo,
    redoStack,
    handleRedo,
    showShapePicker,
    setSelectedShapeKind,
    setShowShapePicker,
    setConnectingSourceId,
    isUploadingCanvasImage,
    handleUploadCanvasImage,
    setZoom,
    setPan,
    setTaskViewMode,
    taskViewMode,
    handleOpenNewTaskModal,
    dragOverCol,
    handleColDragOver,
    handleColDragLeave,
    handleColDrop,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleOpenEditTaskModal,
    draggedTaskId,
    setTasks,
    handleTaskDeleted,
    getSpaceName,
    setIsNewProjectModalOpen,
    loadingProjects,
    projects,
    isNewProjectModalOpen,
    spaces,
    isTaskModalOpen,
    taskToEdit,
    defaultTaskCol,
    setIsTaskModalOpen,
    handleTaskSaved  
};
}
export type ProjectController = ReturnType<typeof useProjectController>;
