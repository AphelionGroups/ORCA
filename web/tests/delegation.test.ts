import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task, CalendarEvent } from '../src/services/api';
import { dashboardTasks, defaultLayout, parseLayout } from '../src/services/dashboard.ts';
import { delegatedTasks, followUpLabel } from '../src/services/delegation.ts';

const task = (id: string, data: Partial<Task> = {}) => ({ id, title: id, status: 'todo', ...data }) as Task;

test('follow-up adds the original open task to Daily once, independently of its deadline, plan and sessions', () => {
 const tasks = [
  task('follow', { delegated_to: 'Dimas', follow_up_date: '2026-11-15', due_date: '2026-11-20' }),
  task('all', { delegated_to: 'Rani', follow_up_date: '2026-11-15', due_date: '2026-11-15', planned_date: '2026-11-15' }),
  task('past', { delegated_to: 'Vendor', follow_up_date: '2026-11-14' }),
  task('future', { delegated_to: 'Vendor', follow_up_date: '2026-11-16' }),
  task('done', { delegated_to: 'Dimas', follow_up_date: '2026-11-15', status: 'done' }),
  task('cancelled', { delegated_to: 'Dimas', follow_up_date: '2026-11-15', status: 'cancelled' }),
  task('child', { parent_task_id: 'follow' }),
  task('deadline', { delegated_to: 'Dimas', due_date: '2026-11-15' }),
 ];
 const event = { linked_task_id: 'all', start_at: '2026-11-15T01:00:00Z', end_at: '2026-11-15T02:00:00Z' } as CalendarEvent;
 const result = dashboardTasks(tasks, [event, event], '2026-11-15', 'Asia/Jakarta');
 assert.deepEqual(result.daily.map(item => item.id), ['follow', 'all', 'deadline']);
 assert.equal(result.daily[0], tasks[0]);
 assert.ok(result.delegated.some(item => item.id === 'past'));
 assert.ok(!result.delegated.some(item => item.id === 'child'));
});

test('waiting tasks sort overdue, today, future, then undated, without changing source order', () => {
 const tasks = [task('undated', { delegated_to: 'Dimas' }), task('future', { delegated_to: 'Rani', follow_up_date: '2026-11-20' }), task('today', { delegated_to: 'Vendor', follow_up_date: '2026-11-15' }), task('past', { delegated_to: 'Vendor', follow_up_date: '2026-11-13' }), task('closed', { delegated_to: 'Vendor', status: 'done' })];
 assert.deepEqual(delegatedTasks(tasks).map(item => item.id), ['past', 'today', 'future', 'undated']);
 assert.equal(tasks[0]!.id, 'undated');
 assert.equal(followUpLabel(tasks[3]!, '2026-11-15'), 'Follow-up lewat 2 hari');
 assert.equal(followUpLabel(tasks[2]!, '2026-11-15'), 'Follow-up hari ini');
 assert.equal(followUpLabel(tasks[0]!, '2026-11-15'), 'Belum ada tanggal follow-up');
 assert.match(followUpLabel(tasks[1]!, '2026-11-15'), /20 November/);
 assert.equal(followUpLabel(task('dst', { delegated_to: 'Rani', follow_up_date: '2026-03-07' }), '2026-03-09'), 'Follow-up lewat 2 hari');
});

test('waiting widget is opt-in and retains its bounded saved layout', () => {
 assert.ok(defaultLayout().every(widget => widget.id !== 'delegated'));
 assert.deepEqual(parseLayout('[{"id":"delegated","columns":8,"height":360}]'), [{ id: 'delegated', columns: 8, height: 360 }]);
});
