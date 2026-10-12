import type { CalendarEvent, Task } from './api';

export type CalendarMode = 'Month' | 'Week' | 'Day' | 'Timeline';
export interface CalendarItem {
  id: string; title: string; spaceId?: string; start: Date; end: Date;
  allDay: boolean; kind: 'Event' | 'Task'; status?: string;
}
export const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function calendarDays(anchor: Date, mode: CalendarMode): Date[] {
  if (mode === 'Day') return [dayStart(anchor)];
  const first = mode === 'Month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : dayStart(anchor);
  const monday = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: mode === 'Month' ? 42 : 7 }, (_, i) => addDays(monday, i));
}
export function moveCalendar(anchor: Date, mode: CalendarMode, direction: number): Date {
  if (mode !== 'Month') return addDays(anchor, direction * (mode === 'Day' ? 1 : 7));
  const first = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(anchor.getDate(), last));
}
// Task dates represent calendar dates, including when serialized as midnight UTC.
export function taskDate(task: Task): Date | undefined {
  const value = task.planned_date || task.due_date;
  if (!value) return;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dateKey(date) === match[0] ? date : undefined;
}
export function calendarItems(events: CalendarEvent[], tasks: Task[]): CalendarItem[] {
  const linked = new Set(events.map(event => event.linked_task_id).filter(Boolean));
  const items: CalendarItem[] = events.flatMap(event => {
    const start = new Date(event.start_at), end = new Date(event.end_at);
    return Number.isFinite(start.getTime()) && end > start ? [{ id: `event:${event.id}`, title: event.title, spaceId: event.space_id, start, end, allDay: event.is_all_day, kind: 'Event' as const }] : [];
  });
  for (const task of tasks) {
    const start = taskDate(task);
    if (!start || task.status === 'cancelled' || linked.has(task.id)) continue;
    items.push({ id: `task:${task.id}`, title: task.title, spaceId: task.space_id, start, end: addDays(start, 1), allDay: true, kind: 'Task', status: task.status });
  }
  return items.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
}
export const itemsOnDay = (items: CalendarItem[], day: Date) => items.filter(item => item.start < addDays(day, 1) && item.end > dayStart(day));

// Allocate lanes to overlapping events; an event ending at another's start does not overlap.
export function timedLayout(items: CalendarItem[], day: Date) {
  const start = dayStart(day).getTime(), end = addDays(day, 1).getTime();
  const rows = itemsOnDay(items, day).filter(item => !item.allDay).map(item => ({
    item, start: Math.max(start, item.start.getTime()), end: Math.min(end, item.end.getTime()), lane: 0, lanes: 1,
  })).sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof rows = [], ends: number[] = [], groupEnd = 0;
  const finish = () => { for (const row of group) row.lanes = ends.length; group = []; ends = []; };
  for (const row of rows) {
    if (group.length && row.start >= groupEnd) finish();
    let lane = ends.findIndex(value => value <= row.start);
    if (lane < 0) lane = ends.length;
    row.lane = lane; ends[lane] = row.end; group.push(row);
    groupEnd = Math.max(...group.map(value => value.end));
  }
  finish();
  return rows.map(row => {
    const minutes = (value: number) => value >= end ? 1440 : new Date(value).getHours() * 60 + new Date(value).getMinutes();
    return { ...row, top: minutes(row.start) / 60 * 48, height: Math.max(22, (minutes(row.end) - minutes(row.start)) / 60 * 48) };
  });
}
