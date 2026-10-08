import type { api as gateway } from '../../services/api';
import type { CanvasAction } from './canvas';

type HistoryGateway = Pick<typeof gateway, 'deleteNoteBlock' | 'restoreNoteBlock' | 'updateNoteBlock'>;

// Confirm persistence before moving an action between history stacks.
export async function persistCanvasAction(api: HistoryGateway, action: CanvasAction, direction: 'undo' | 'redo') {
  const undo = direction === 'undo';
  switch (action.type) {
    case 'create_block':
      if (undo) await api.deleteNoteBlock(action.block.id);
      else await api.restoreNoteBlock(action.block.id);
      break;
    case 'delete_blocks':
      for (const block of action.blocks) {
        if (undo) await api.restoreNoteBlock(block.id);
        else await api.deleteNoteBlock(block.id);
      }
      break;
    case 'move_blocks':
      for (const move of action.moves) {
        await api.updateNoteBlock(move.id, { pos_x: undo ? move.fromX : move.toX, pos_y: undo ? move.fromY : move.toY });
      }
      break;
    case 'update_text':
      await api.updateNoteBlock(action.blockId, { content: undo ? action.prevContent : action.newContent });
      break;
    case 'resize_block':
      await api.updateNoteBlock(action.blockId, {
        pos_x: undo ? action.prevX : action.newX,
        pos_y: undo ? action.prevY : action.newY,
        width: undo ? action.prevWidth : action.newWidth,
        height: (undo ? action.prevHeight : action.newHeight) ?? 0,
      });
      break;
  }
}
