import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTasks, parseLayout, snapWidgetSize } from '../src/services/dashboard.ts';
import type { Task, CalendarEvent } from '../src/services/api';

const task = (id: string, fields: Partial<Task> = {}) => ({ id, status: 'todo', ...fields }) as Task;
const session = (id: string, linked_task_id: string, start_at: string, end_at: string) => ({ id, linked_task_id, start_at, end_at }) as CalendarEvent;
test('Daily includes each source independently, deduplicates tasks, and excludes closed work', () => {
  const result = dashboardTasks([
    task('planned', { planned_date: '2026-11-14T00:00:00Z' }),
    task('due', { planned_date: '2026-11-15', due_date: '2026-11-14' }),
    task('linked', { due_date: '2026-12-01' }),
    task('done', { planned_date: '2026-11-14', status: 'done' }),
    task('cancelled', { due_date: '2026-11-14', status: 'cancelled' }),
    task('backlog'),
  ], [session('a', 'linked', '2026-11-13T18:00:00Z', '2026-11-13T19:00:00Z'), session('b', 'linked', '2026-11-14T02:00:00Z', '2026-11-14T03:00:00Z')], '2026-11-14', 'Asia/Jakarta');
  assert.deepEqual(result.daily.map(item => item.id), ['planned', 'due', 'linked']);
  assert.deepEqual(result.unscheduled.map(item => item.id), ['backlog']);
});
test('midnight is exclusive, overnight sessions overlap, and future sessions are scheduled', () => {
  const result = dashboardTasks([task('boundary'), task('overnight'), task('future')], [
    session('a', 'boundary', '2026-11-13T16:00:00Z', '2026-11-13T17:00:00Z'),
    session('b', 'overnight', '2026-11-13T16:00:00Z', '2026-11-13T18:00:00Z'),
    session('c', 'future', '2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z'),
  ], '2026-11-14', 'Asia/Jakarta');
  assert.deepEqual(result.daily.map(item => item.id), ['overnight']);
  assert.equal(result.unscheduled.length, 0);
});
test('saved layouts retain intentional empty state and recover malformed data', () => {
  assert.deepEqual(parseLayout('[]'), []);
  assert.equal(parseLayout('{broken')[0]?.id, 'daily');
  assert.deepEqual(parseLayout('[{"id":"agenda","wide":true},{"id":"agenda"},{"id":"unknown"}]'), [{ id: 'agenda', columns: 12, height: 360 }]);
});
test('sizes snap to bounded grid steps and persisted legacy layouts migrate', () => {
  assert.deepEqual(snapWidgetSize(-50, -500), { columns: 4, height: 240 });
  assert.deepEqual(snapWidgetSize(100, 9000), { columns: 12, height: 480 });
  assert.deepEqual(snapWidgetSize(7.8, 350), { columns: 8, height: 360 });
  assert.deepEqual(parseLayout('[{"id":"daily","wide":false}]'), [{ id: 'daily', columns: 6, height: 360 }]);
  assert.deepEqual(parseLayout('[{"id":"daily","columns":999,"height":-1}]'), [{ id: 'daily', columns: 12, height: 240 }]);
});
