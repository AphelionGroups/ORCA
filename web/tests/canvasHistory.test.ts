import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistCanvasAction } from '../src/views/project/canvasHistory.ts';
import type { NoteBlock } from '../src/services/api';

const block = { id: 'existing-block' } as NoteBlock;
test('undo delete and redo create restore the original record instead of inserting duplicate IDs', async () => {
  const restored: string[] = [];
  const api = {
    restoreNoteBlock: async (id: string) => { restored.push(id); return block; },
    deleteNoteBlock: async () => { throw new Error('Unexpected delete'); },
    updateNoteBlock: async () => { throw new Error('Unexpected update'); },
  };
  await persistCanvasAction(api, { type: 'delete_blocks', blocks: [block], connections: [] }, 'undo');
  await persistCanvasAction(api, { type: 'create_block', block }, 'redo');
  assert.deepEqual(restored, ['existing-block', 'existing-block']);
});

test('history failures propagate so the caller retains the pending action', async () => {
  const failure = new Error('Network unavailable');
  const api = {
    restoreNoteBlock: async () => { throw failure; },
    deleteNoteBlock: async () => { throw failure; },
    updateNoteBlock: async () => { throw failure; },
  };
  await assert.rejects(persistCanvasAction(api, { type: 'create_block', block }, 'undo'), failure);
});
