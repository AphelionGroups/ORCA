import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionSlot, sessionConflicts, tasksToSchedule } from '../src/services/calendarPlanning.ts';
import { calendarItems } from '../src/services/calendar.ts';
import type { Task, CalendarEvent } from '../src/services/api';
const task = (id: string, data: Partial<Task> = {}) => ({ id, title: id, status: 'todo', ...data }) as Task;
const event = (id: string, start_at: string, end_at: string, data: Partial<CalendarEvent> = {}) => ({ id, title: id, start_at, end_at, is_all_day: false, ...data }) as CalendarEvent;
test('planned days, deadlines and linked sessions keep separate identities', () => {
  const items = calendarItems([event('session', '2026-11-11T09:00:00Z', '2026-11-11T10:00:00Z', { linked_task_id: 'task' })], [task('task', { planned_date: '2026-11-11', due_date: '2026-11-13' })]);
  assert.deepEqual(items.map(item => item.category).sort(), ['deadline', 'planned', 'session']);
  assert.equal(new Set(items.map(item => item.id)).size, 3);
});
test('slot snapping preserves timezone and crosses midnight with a real end date', () => {
  const slot = sessionSlot('2026-11-14', 1424, 'Asia/Jakarta', 60);
  assert.equal(slot.start_at, '2026-11-14T16:45:00.000Z');
  assert.equal(slot.end_at, '2026-11-14T17:45:00.000Z');
  assert.throws(() => sessionSlot('2026-03-08', 150, 'America/New_York'), /does not exist/);
});
test('overlap excludes self, all-day entries and adjacent sessions', () => {
  const events = [event('a', '2026-11-14T09:00:00Z', '2026-11-14T10:00:00Z'), event('b', '2026-11-14T10:00:00Z', '2026-11-14T11:00:00Z'), event('all', '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z', { is_all_day: true })];
  assert.equal(sessionConflicts(events, events[0]!).length, 0);
  assert.equal(sessionConflicts(events, { start_at: '2026-11-14T09:30:00Z', end_at: '2026-11-14T10:30:00Z' }).length, 2);
});
test('dated tasks without a future session remain available for scheduling', () => {
  const tasks = [task('today', { due_date: '2026-11-14' }), task('late', { due_date: '2026-11-13' }), task('done', { status: 'done' }), task('booked')];
  const events = [event('future', '2099-11-14T09:00:00Z', '2099-11-14T10:00:00Z', { linked_task_id: 'booked' })];
  assert.deepEqual(tasksToSchedule(tasks, events, '2026-11-14', 'today').map(item => item.id), ['today']);
  assert.deepEqual(tasksToSchedule(tasks, events, '2026-11-14', 'overdue').map(item => item.id), ['late']);
  assert.deepEqual(tasksToSchedule(tasks, events, '2026-11-14', 'all').map(item => item.id), ['today', 'late']);
});
