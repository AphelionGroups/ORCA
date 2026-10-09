import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, calendarDays, shiftCalendar, wallTimeToInstant, zonedParts, overlapsDay, layoutDayEvents } from '../src/services/calendarDates.ts';

test('weeks start on Monday and include both weekend days across year boundaries', () => {
  assert.deepEqual(calendarDays('2027-01-01', 'Week'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(calendarDays('2026-10-09', 'Month').length, 42);
  assert.equal(shiftCalendar('2026-01-31', 'Month', 1), '2026-02-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
test('timezone conversion preserves the chosen date and rejects nonexistent DST times', () => {
  assert.equal(wallTimeToInstant('2026-10-09', '00:30', 'Asia/Jakarta'), '2026-10-08T17:30:00.000Z');
  assert.deepEqual(zonedParts('2026-10-08T17:30:00Z', 'Asia/Jakarta'), { date: '2026-10-09', time: '00:30', second: 0 });
  assert.throws(() => wallTimeToInstant('2026-03-08', '02:30', 'America/New_York'), /does not exist/);
});
test('overnight events span their dates and exclusive end boundaries avoid duplication', () => {
  const event = { start_at: '2026-10-08T16:30:00Z', end_at: '2026-10-08T18:00:00Z' };
  assert.equal(overlapsDay(event, '2026-10-08', 'Asia/Jakarta'), true);
  assert.equal(overlapsDay(event, '2026-10-09', 'Asia/Jakarta'), true);
  assert.equal(overlapsDay({ ...event, end_at: '2026-10-08T17:00:00Z' }, '2026-10-09', 'Asia/Jakarta'), false);
});
test('overlapping sessions have separate lanes and actual minute positions', () => {
  const entries = layoutDayEvents([
    { start_at: '2026-10-09T03:15:00Z', end_at: '2026-10-09T04:15:00Z', is_all_day: false },
    { start_at: '2026-10-09T03:30:00Z', end_at: '2026-10-09T05:00:00Z', is_all_day: false },
    { start_at: '2026-10-09T06:00:00Z', end_at: '2026-10-09T07:00:00Z', is_all_day: false },
  ], '2026-10-09', 'Asia/Jakarta');
  assert.equal(entries[0].start, 615);
  assert.equal(entries[0].end - entries[0].start, 60);
  assert.deepEqual(entries.map(entry => [entry.lane, entry.lanes]), [[0, 2], [1, 2], [0, 1]]);
});
