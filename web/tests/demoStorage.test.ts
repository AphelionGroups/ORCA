import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoRequest, resetDemo, demoPersistence } from '../src/services/demoStorage.ts';
import { DEMO_STORAGE_KEY } from '../src/services/demoSeed.ts';

const values = new Map<string, string>();
let failWrites = false;
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrites) throw new DOMException('Full', 'QuotaExceededError'); values.set(key, value); },
};
Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
const call = async (path: string, method = 'GET', data?: unknown): Promise<any> => (await demoRequest<{ data: unknown }>(path, { method, ...(data ? { body: JSON.stringify(data) } : {}) })).data;

test('demo mutations persist, reject stale updates, and preserve seed on failure', async () => {
  resetDemo(); const spaces = await call('/spaces'); const tasks = await call('/tasks');
  const task = await call('/tasks', 'POST', { space_id: spaces[0].id, title: 'A local task' });
  assert.ok(JSON.parse(values.get(DEMO_STORAGE_KEY)!).tables.tasks.some((row: any) => row.id === task.id));
  const edited = await call(`/tasks/${task.id}`, 'PUT', { title: 'Edited task', expected_updated_at: task.updated_at });
  await assert.rejects(call(`/tasks/${task.id}`, 'PUT', { title: 'Stale', expected_updated_at: task.updated_at }), /changed/);
  failWrites = true;
  await assert.rejects(call(`/tasks/${task.id}`, 'PUT', { title: 'Unsaved', expected_updated_at: edited.updated_at }), /storage is full/);
  failWrites = false;
  assert.equal((await call(`/tasks/${task.id}`)).title, 'Edited task');
  assert.equal((await call('/tasks')).length, tasks.length + 1);
});
test('board operations are atomic and retries, consecutive undo, and redo preserve links', async () => {
  resetDemo(); const board = (await call('/boards'))[0]; const blocks = await call(`/boards/${board.id}/blocks`);
  const operate = (data: unknown) => call(`/boards/${board.id}/operations`, 'POST', data);
  const snapshot = values.get(DEMO_STORAGE_KEY);
  await assert.rejects(operate({ id: 'invalid', mode: 'apply', blocks: [{ action: 'delete', id: blocks[0].id }, { action: 'update', id: 'missing', patch: {} }] }));
  assert.equal(values.get(DEMO_STORAGE_KEY), snapshot);
  const deletion = { id: 'delete', mode: 'apply', blocks: [{ action: 'delete', id: blocks[0].id }] };
  assert.equal((await operate(deletion)).connections.length, 1);
  assert.equal((await operate(deletion)).blocks.length, 2);
  assert.equal((await operate({ id: 'delete', mode: 'undo' })).connections.length, 2);
  assert.equal((await operate({ id: 'delete', mode: 'redo' })).connections.length, 1);
  await operate({ id: 'delete', mode: 'undo' });
  await operate({ id: 'move1', mode: 'apply', blocks: [{ action: 'update', id: blocks[0].id, patch: { pos_x: 100 } }] });
  await operate({ id: 'move2', mode: 'apply', blocks: [{ action: 'update', id: blocks[0].id, patch: { pos_x: 120 } }] });
  await operate({ id: 'move2', mode: 'undo' });
  const restored = await operate({ id: 'move1', mode: 'undo' });
  assert.equal(restored.blocks.find((row: any) => row.id === blocks[0].id).pos_x, blocks[0].pos_x);
  await operate({ id: 'move1', mode: 'redo' });
  await operate({ id: 'move2', mode: 'redo' });
  await call(`/blocks/${blocks[0].id}`, 'PUT', { pos_x: 140 });
  await assert.rejects(operate({ id: 'move2', mode: 'undo' }), /board changed/);
});
test('Inbox conversion and parent deletion keep linked calendar events valid', async () => {
  resetDemo(); const spaces = await call('/spaces'), notes = await call('/inbox');
  const conversion = await call(`/inbox/${notes[0].id}/convert-task`, 'POST', { space_id: spaces[0].id });
  assert.ok(conversion.task_id); assert.equal((await call('/inbox')).length, notes.length - 1);
  await assert.rejects(call(`/inbox/${notes[0].id}/convert-task`, 'POST', { space_id: spaces[0].id }), /already converted/);
  const event = (await call('/events'))[0];
  await call(`/tasks/${event.linked_task_id}`, 'DELETE');
  assert.equal((await call(`/events/${event.id}`)).linked_task_id, null);
  await call(`/spaces/${spaces[0].id}`, 'DELETE');
  assert.equal((await call('/boards')).length, 0);
  assert.equal((await call(`/events/${event.id}`)).space_id, null);
});
test('corrupt storage remains intact until explicit reset', async () => {
  values.set(DEMO_STORAGE_KEY, 'broken');
  await assert.rejects(call('/spaces'), /cannot be opened/);
  assert.equal(values.get(DEMO_STORAGE_KEY), 'broken');
  resetDemo(); assert.equal((await call('/spaces')).length, 2);
});
test('blocked iframe storage falls back to an explicit temporary workspace', async () => {
  Object.defineProperty(globalThis, 'window', { value: { get localStorage() { throw new DOMException('Blocked', 'SecurityError'); } }, configurable: true });
  resetDemo(); const space = (await call('/spaces'))[0];
  const task = await call('/tasks', 'POST', { space_id: space.id, title: 'Temporary task' });
  assert.equal((await call(`/tasks/${task.id}`)).title, 'Temporary task');
  assert.equal(demoPersistence().persistent, false);
});
