import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarDays, moveCalendar, dateKey, calendarItems, itemsOnDay, timedLayout, taskDate } from '../src/services/calendar.ts';
import type { CalendarEvent, Task } from '../src/services/api.ts';
const task = (data: Partial<Task>) => ({ id: 'task', title: 'Task', status: 'todo', ...data } as Task);
const event = (id: string, start: string, end: string, data = {}) => ({ id, title: id, start_at: start, end_at: end, is_all_day: false, ...data } as CalendarEvent);
test('Monday weeks include weekends, month navigation clamps dates and leap years', () => {
  const sunday = new Date(2026, 9, 11);
  assert.deepEqual(calendarDays(sunday, 'Week').map(dateKey), ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
  assert.equal(calendarDays(sunday, 'Month').length, 42);
  assert.equal(calendarDays(sunday, 'Day').length, 1);
  assert.equal(dateKey(moveCalendar(new Date(2024, 0, 31), 'Month', 1)), '2024-02-29');
  assert.equal(dateKey(moveCalendar(sunday, 'Day', -1)), '2026-10-10');
});
test('tasks use planned dates before due dates and never shift UTC date-only values', () => {
  assert.equal(dateKey(taskDate(task({ planned_date: '2026-10-11T00:00:00Z', due_date: '2026-10-12' }))!), '2026-10-11');
  assert.equal(taskDate(task({ due_date: '2026-02-31' })), undefined);
  assert.equal(calendarItems([], [task({ due_date: '2026-10-11' }), task({ status: 'cancelled', planned_date: '2026-10-11' })]).length, 1);
});
test('linked tasks are not duplicated, midnight ends are exclusive and multi-day events span days', () => {
  const ev = event('meeting', '2026-10-10T23:00:00', '2026-10-12T00:00:00', { linked_task_id: 'task' });
  const items = calendarItems([ev], [task({ due_date: '2026-10-11' })]);
  assert.equal(items.length, 1);
  assert.equal(itemsOnDay(items, new Date(2026, 9, 11)).length, 1);
  assert.equal(itemsOnDay(items, new Date(2026, 9, 12)).length, 0);
});
test('timed events follow actual time and overlaps receive separate lanes', () => {
  const events = [event('a', '2026-10-11T09:00:00','2026-10-11T10:00:00'), event('b','2026-10-11T09:30:00','2026-10-11T11:00:00'), event('c','2026-10-11T11:00:00','2026-10-11T12:00:00')];
  const rows = timedLayout(calendarItems(events, []), new Date(2026,9,11));
  assert.equal(rows[0]!.top, 9 * 48);
  assert.equal(rows[0]!.height, 48);
  assert.equal(rows[0]!.lanes, 2);
  assert.notEqual(rows[0]!.lane, rows[1]!.lane);
  assert.equal(rows[2]!.lanes, 1);
});
