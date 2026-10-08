import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionOperation } from '../src/views/project/canvasHistory.ts';
import { newOperationID } from '../src/services/identity.ts';
import type { NoteBlock } from '../src/services/api';
test('movement batches preserve each loaded block version', () => {
 const blocks = [{id:'a',updated_at:'2026-10-09T01:00:00Z'},{id:'b',updated_at:'2026-10-09T02:00:00Z'}] as NoteBlock[];
 const operation=actionOperation({type:'move_blocks',moves:blocks.map(block=>({id:block.id,fromX:0,fromY:0,toX:10,toY:20}))},'receipt',blocks);
 assert.equal(operation.blocks?.length,2);
 assert.deepEqual(operation.blocks?.map(m=>m.patch?.expected_updated_at),blocks.map(b=>b.updated_at));
});
test('reconnecting preserves connector identity',()=>{
 const operation=actionOperation({type:'update_connection',prevConnection:{id:'link',fromId:'a',toId:'b'},newConnection:{fromId:'a',toId:'c'}},'receipt',[]);
 assert.equal(operation.connections?.[0].connection.id,'link');
});
test('operation IDs are unique UUIDv7',()=>{
 const ids=Array.from({length:100},()=>newOperationID());
 assert.equal(new Set(ids).size,100);
 for(const id of ids) assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
