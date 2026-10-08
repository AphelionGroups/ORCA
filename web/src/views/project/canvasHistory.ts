import type { BoardOperation, NoteBlock } from '../../services/api';
import type { CanvasAction } from './canvas';

export function actionOperation(action: CanvasAction, id: string, blocks: NoteBlock[]): BoardOperation {
  const update = (id: string, patch: Partial<NoteBlock>) => ({ id, action: 'update' as const, patch: { ...patch, expected_updated_at: blocks.find(block => block.id === id)?.updated_at } });
  const operation: BoardOperation = { id, mode: 'apply' };
  switch (action.type) {
    case 'delete_blocks': operation.blocks = action.blocks.map(block => ({ id: block.id, action: 'delete', patch: { expected_updated_at: block.updated_at } })); break;
    case 'move_blocks': operation.blocks = action.moves.map(move => update(move.id, { pos_x: move.toX, pos_y: move.toY })); break;
    case 'update_text': operation.blocks = [update(action.blockId, { content: action.newContent })]; break;
    case 'resize_block': operation.blocks = [update(action.blockId, { pos_x: action.newX, pos_y: action.newY, width: action.newWidth, height: action.newHeight ?? 0 })]; break;
    case 'create_connection': operation.connections = [{ action: 'create', connection: action.connection }]; break;
    case 'delete_connection': operation.connections = [{ action: 'delete', connection: action.connection }]; break;
    case 'update_connection': operation.connections = [{ action: 'update', connection: { ...action.newConnection, id: action.prevConnection.id, updated_at: action.prevConnection.updated_at } }]; break;
    case 'create_block': throw new Error('Block creation already has a server receipt');
  }
  return operation;
}
