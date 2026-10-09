import { createDemoSeed, DEMO_STORAGE_KEY, tableNames } from './demoSeed.ts';
import type { DemoState, Row, Snapshot, Table } from './demoSeed.ts';
import { newOperationID } from './identity.ts';

export class DemoError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'DemoError'; this.status = status; }
}
let memory: DemoState | undefined;
let persistence = true;
let storageProblem = '';
export const demoPersistence = () => ({ persistent: persistence, message: storageProblem });
const clone = <T>(value: T): T => structuredClone(value);
const active = (row: Row) => !row.deleted_at;
function storage(): Storage | null {
  try { return window.localStorage; }
  catch { persistence = false; storageProblem = 'Your browser blocks saved data here. Changes last until this page is closed.'; return null; }
}
function save(state: DemoState) {
  const target = storage();
  if (target) {
    try { target.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        persistence = false; storageProblem = 'Your browser blocks saved data here. Changes last until this page is closed.';
      } else { throw new DemoError('Demo storage is full. Remove large images or reset the demo before saving.', 507); }
    }
  }
  memory = clone(state);
}
function read(): DemoState {
  const target = storage();
  let raw: string | null = null;
  try { raw = target?.getItem(DEMO_STORAGE_KEY) || null; }
  catch { persistence = false; storageProblem = 'Your browser blocks saved data here. Changes last until this page is closed.'; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !parsed.profile?.workspace_id || !parsed.operations || tableNames.some(name => !Array.isArray(parsed.tables?.[name]))) throw new Error();
      return parsed;
    } catch { throw new DemoError('Saved demo data cannot be opened. Use Reset demo to start again.', 422); }
  }
  if (memory) return clone(memory);
  const seed = createDemoSeed(); save(seed); return seed;
}
export function resetDemo() { save(createDemoSeed()); }
export function getDemoProfile() { return clone(read().profile); }
let lastTime = 0;
const stamp = () => { lastTime = Math.max(Date.now(), lastTime + 1); return new Date(lastTime).toISOString(); };
function found(state: DemoState, table: Table, id: string, allowDeleted = false): Row {
  const row = state.tables[table].find(item => item.id === id && (allowDeleted || active(item)));
  if (!row) throw new DemoError('This item no longer exists.', 404);
  return row;
}
function checkVersion(row: Row, patch: Row) {
  if (patch.expected_updated_at && patch.expected_updated_at !== row.updated_at) throw new DemoError('This item changed in another tab. Reload and try again.', 409);
}
function validate(state: DemoState, table: Table, row: Row) {
  const ref = (name: Table, id: string | null | undefined) => id ? found(state, name, id) : undefined;
  if (['projects', 'documents', 'boards', 'tasks'].includes(table) && !row.space_id) throw new DemoError('Choose a space.');
  ref('spaces', row.space_id);
  const project = ref('projects', row.project_id);
  if (project && project.space_id !== row.space_id) throw new DemoError('Project must belong to the selected space.');
  const parent = ref('tasks', row.parent_task_id);
  if (parent) {
    const seen = new Set([row.id]); let cursor: Row | undefined = parent;
    while (cursor) { if (seen.has(cursor.id)) throw new DemoError('Tasks cannot form a parent cycle.'); seen.add(cursor.id); cursor = ref('tasks', cursor.parent_task_id); }
  }
  ref('tasks', row.linked_task_id);
  if (table === 'tasks') {
    if (!['todo', 'in_progress', 'in_review', 'done', 'cancelled'].includes(row.status)) throw new DemoError('Invalid task status.');
    if (!['low', 'medium', 'high', 'urgent'].includes(row.priority)) throw new DemoError('Invalid task priority.');
    if (row.estimated_minutes != null && (!Number.isInteger(row.estimated_minutes) || row.estimated_minutes < 0)) throw new DemoError('Estimate must be a nonnegative number of minutes.');
  }
  if (table === 'events' && !(Date.parse(row.end_at) > Date.parse(row.start_at))) throw new DemoError('End time must be after start time.');
  if (table === 'blocks') {
    ref('boards', row.board_id);
    if (!['sticky', 'text', 'card', 'image', 'task_embed', 'shape'].includes(row.type)) throw new DemoError('Invalid block type.');
    if (![row.pos_x, row.pos_y].every(Number.isFinite)) throw new DemoError('Invalid block position.');
  }
  if (table === 'connections') {
    const a = found(state, 'blocks', row.fromId), b = found(state, 'blocks', row.toId);
    if (a.id === b.id || a.board_id !== b.board_id || a.board_id !== row.board_id) throw new DemoError('Connect cards on the same board.');
    for (const side of [row.fromSide, row.toSide]) if (side && !['top', 'right', 'bottom', 'left'].includes(side)) throw new DemoError('Invalid connector side.');
  }
  if (['spaces', 'projects', 'documents', 'boards', 'tasks', 'events', 'inbox'].includes(table)) {
    const title = row.name ?? row.title ?? row.content;
    if (typeof title !== 'string' || !title.trim()) throw new DemoError('Please enter a name or content.');
  }
}
function create(state: DemoState, table: Table, data: Row, id = newOperationID()): Row {
  if (state.tables[table].some(row => row.id === id)) throw new DemoError('Item already exists.', 409);
  const defaults: Partial<Record<Table, Row>> = {
    spaces: { icon: 'work', color: '#B2FFA9', sort_order: 0, slug: id }, projects: { status: 'active', kanban_columns: ['Backlog', 'Todo', 'In Progress', 'Done'] },
    tasks: { status: 'todo', priority: 'medium' }, documents: { content: '', doc_type: 'general', is_pinned: false }, boards: { viewport_state: { x: 0, y: 0, zoom: 1 } },
    blocks: { pos_x: 0, pos_y: 0, content: {} }, events: { is_all_day: false }, inbox: { color: 'default', is_archived: false },
  };
  const time = stamp();
  const row: Row = { ...defaults[table], ...data, id, workspace_id: state.profile.workspace_id, created_at: time, updated_at: time };
  delete row.expected_updated_at; delete row.deleted_at;
  validate(state, table, row); state.tables[table].push(row); return row;
}
function update(state: DemoState, table: Table, id: string, patch: Row): Row {
  const row = found(state, table, id); checkVersion(row, patch);
  const clean = { ...patch }; for (const field of ['id', 'workspace_id', 'created_at', 'updated_at', 'deleted_at', 'expected_updated_at', 'board_id']) delete clean[field];
  const result = { ...row, ...clean, updated_at: stamp() }; validate(state, table, result); Object.assign(row, result); return row;
}
function remove(state: DemoState, table: Table, id: string) {
  const row = found(state, table, id); row.deleted_at = stamp(); row.updated_at = row.deleted_at;
  const cascade = (name: Table, field: string) => { for (const child of state.tables[name].filter(item => active(item) && item[field] === id)) remove(state, name, child.id); };
  if (table === 'spaces') { cascade('projects', 'space_id'); cascade('documents', 'space_id'); cascade('boards', 'space_id'); cascade('tasks', 'space_id'); }
  if (table === 'projects') { cascade('documents', 'project_id'); cascade('boards', 'project_id'); cascade('tasks', 'project_id'); }
  if (table === 'tasks') cascade('tasks', 'parent_task_id');
  if (table === 'boards') cascade('blocks', 'board_id');
  if (table === 'blocks') for (const link of state.tables.connections.filter(item => active(item) && (item.fromId === id || item.toId === id))) remove(state, 'connections', link.id);
  if (table === 'spaces' || table === 'tasks') for (const event of state.tables.events.filter(active)) {
    const field = table === 'spaces' ? 'space_id' : 'linked_task_id';
    if (event[field] === id) { event[field] = null; event.updated_at = stamp(); }
  }
}
const snapshot = (state: DemoState, board: string): Snapshot => clone({ blocks: state.tables.blocks.filter(row => row.board_id === board), connections: state.tables.connections.filter(row => row.board_id === board) });
function semantic(value: Snapshot): string {
  const normalize = (rows: Row[]) => rows.map(row => ({
    ...Object.fromEntries(Object.entries(row).filter(([field]) => !['updated_at', 'created_at', 'deleted_at'].includes(field)).sort(([a], [b]) => a.localeCompare(b))),
    deleted: !!row.deleted_at,
  })).sort((a, b) => String((a as Row).id).localeCompare(String((b as Row).id)));
  return JSON.stringify({ blocks: normalize(value.blocks), connections: normalize(value.connections) });
}
function graph(state: DemoState, board: string, id: string) {
  const current = snapshot(state, board); return { id, blocks: current.blocks.filter(active), connections: current.connections.filter(active) };
}
function operate(state: DemoState, board: string, op: Row) {
  found(state, 'boards', board);
  if (!op.id || !['apply', 'undo', 'redo'].includes(op.mode)) throw new DemoError('Invalid board operation.');
  const receipt = state.operations[op.id];
  if (receipt && receipt.board_id !== board) throw new DemoError('Operation belongs to another board.', 409);
  if (op.mode !== 'apply') {
    if (!receipt) throw new DemoError('Undo history is unavailable.', 404);
    const targetState = op.mode === 'undo' ? 'undone' : 'applied';
    if (receipt.state === targetState) return graph(state, board, op.id);
    const expected = op.mode === 'undo' ? receipt.after : receipt.before;
    if (semantic(snapshot(state, board)) !== semantic(expected)) throw new DemoError('The board changed. Reload before undoing.', 409);
    const target = clone(op.mode === 'undo' ? receipt.before : receipt.after);
    for (const name of ['blocks', 'connections'] as const) {
      state.tables[name] = state.tables[name].filter(row => row.board_id !== board);
      state.tables[name].push(...target[name].map(row => ({ ...row, updated_at: stamp() })));
    }
    receipt.state = targetState; return graph(state, board, op.id);
  }
  if (receipt) return graph(state, board, op.id);
  const before = snapshot(state, board);
  if ((op.blocks?.length || 0) + (op.connections?.length || 0) > 200) throw new DemoError('Too many changes at once.');
  for (const mutation of op.blocks || []) {
    if (mutation.action === 'create') create(state, 'blocks', { ...mutation.create, board_id: board }, mutation.id || mutation.create?.id);
    else {
      const row = found(state, 'blocks', mutation.id, mutation.action === 'restore');
      if (row.board_id !== board) throw new DemoError('Block belongs to another board.');
      checkVersion(row, mutation.patch || {});
      if (mutation.action === 'delete') remove(state, 'blocks', row.id);
      else if (mutation.action === 'restore') { delete row.deleted_at; row.updated_at = stamp(); validate(state, 'blocks', row); }
      else if (mutation.action === 'update') update(state, 'blocks', row.id, mutation.patch || {});
      else throw new DemoError('Invalid block action.');
    }
  }
  for (const mutation of op.connections || []) {
    const connection = mutation.connection;
    if (mutation.action === 'create') {
      if (state.tables.connections.some(row => active(row) && row.board_id === board && row.fromId === connection.fromId && row.toId === connection.toId)) throw new DemoError('Connection already exists.', 409);
      create(state, 'connections', { ...connection, board_id: board }, connection.id);
    } else {
      const row = found(state, 'connections', connection.id);
      if (row.board_id !== board) throw new DemoError('Connection belongs to another board.');
      checkVersion(row, { expected_updated_at: connection.updated_at });
      if (mutation.action === 'delete') remove(state, 'connections', row.id);
      else if (mutation.action === 'update') update(state, 'connections', row.id, connection);
      else throw new DemoError('Invalid connection action.');
    }
  }
  state.operations[op.id] = { board_id: board, state: 'applied', before, after: snapshot(state, board) };
  return graph(state, board, op.id);
}
function route(state: DemoState, path: string, method: string, data: Row): unknown {
  const url = new URL(path, 'https://demo.invalid'); const [resource, id, action] = url.pathname.split('/').filter(Boolean);
  if (resource === 'profile') {
    if (method !== 'GET') throw new DemoError('The demo profile is read-only.', 405);
    return state.profile;
  }
  if (resource === 'preferences') {
    if (method === 'PUT') { try { new Intl.DateTimeFormat('en', { timeZone: data.calendar_timezone }); } catch { throw new DemoError('Choose a valid timezone.'); } state.preferences.calendar_timezone = data.calendar_timezone; }
    return state.preferences;
  }
  if (!tableNames.includes(resource as Table)) throw new DemoError('Unsupported demo action.', 404);
  const table = resource as Table;
  if (table === 'boards' && action) {
    const board = found(state, 'boards', id);
    if (action === 'blocks') return state.tables.blocks.filter(row => active(row) && row.board_id === id);
    if (action === 'connections') return state.tables.connections.filter(row => active(row) && row.board_id === id);
    if (action === 'operations') return operate(state, id, data);
    if (action === 'viewport') { if (![data.x, data.y, data.zoom].every(Number.isFinite) || data.zoom < 0.2 || data.zoom > 2) throw new DemoError('Invalid viewport.'); board.viewport_state = data; return null; }
  }
  if (table === 'blocks' && action === 'restore') { const row = found(state, table, id, true); delete row.deleted_at; row.updated_at = stamp(); validate(state, table, row); return row; }
  if (table === 'inbox' && action?.startsWith('convert-')) {
    const note = found(state, table, id);
    if (note.is_archived) throw new DemoError('This note was already converted or archived.', 409);
    const document = action === 'convert-doc';
    if (!document && action !== 'convert-task') throw new DemoError('Unsupported conversion.');
    const created = create(state, document ? 'documents' : 'tasks', { ...data, title: data.title || note.content.slice(0, 100), ...(document ? { content: note.content } : { description: note.content }) });
    note.is_archived = true; note.updated_at = stamp(); return { [document ? 'document_id' : 'task_id']: created.id };
  }
  if (method === 'GET') {
    if (id) return found(state, table, id);
    let rows = state.tables[table].filter(active);
    for (const key of ['space_id', 'project_id', 'planned_date', 'status']) { const value = url.searchParams.get(key); if (value) rows = rows.filter(row => row[key] === value); }
    if (url.searchParams.get('inbox') === 'true') rows = rows.filter(row => !row.project_id);
    if (table === 'inbox' && url.searchParams.get('archived') !== 'true') rows = rows.filter(row => !row.is_archived);
    if (table === 'events') { const start = url.searchParams.get('start'), end = url.searchParams.get('end'); rows = rows.filter(row => (!start || Date.parse(row.end_at) > Date.parse(start)) && (!end || Date.parse(row.start_at) < Date.parse(end))); }
    if (table === 'boards') return rows.map(row => ({ ...row, block_count: state.tables.blocks.filter(block => active(block) && block.board_id === row.id).length }));
    return rows;
  }
  if (method === 'POST' && !id) return create(state, table, data);
  if (method === 'PUT' && id) return update(state, table, id, data);
  if (method === 'DELETE' && id) { remove(state, table, id); return null; }
  throw new DemoError('Unsupported demo action.', 404);
}
export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method || 'GET';
  const state = clone(read());
  const data = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  const result = route(state, path, method, data);
  if (method !== 'GET') save(state);
  return clone({ data: result }) as T;
}
export async function localImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new DemoError('Choose a PNG, JPEG, WebP, or GIF image.');
  if (file.size > 1024 * 1024) throw new DemoError('Choose an image smaller than 1 MB for this demo.');
  const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new DemoError('Unable to read this image.')); reader.readAsDataURL(file); });
  return { url, object_key: newOperationID(), filename: file.name, size: file.size, content_type: file.type, driver: 'local' };
}
