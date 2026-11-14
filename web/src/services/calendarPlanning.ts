import type { CalendarEvent, Task } from './api';
import { wallTimeToInstant } from './calendarDates.ts';

export function sessionSlot(day: string, minute: number, zone: string, duration = 60) {
  const snapped = Math.max(0, Math.min(1425, Math.round(minute / 15) * 15));
  const start = wallTimeToInstant(day, `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`, zone);
  return { start_at: start, end_at: new Date(Date.parse(start) + Math.max(15, duration) * 60000).toISOString() };
}
export function sessionConflicts(events: CalendarEvent[], candidate: Pick<CalendarEvent, 'start_at' | 'end_at'> & { id?: string }) {
  return events.filter(event => !event.is_all_day && event.id !== candidate.id && Date.parse(event.start_at) < Date.parse(candidate.end_at) && Date.parse(event.end_at) > Date.parse(candidate.start_at));
}
export function tasksToSchedule(tasks: Task[], events: CalendarEvent[], today: string, filter: string) {
  const scheduled = new Set(events.filter(event => Date.parse(event.end_at) > Date.now()).map(event => event.linked_task_id));
  return tasks.filter(task => task.status !== 'done' && task.status !== 'cancelled' && !scheduled.has(task.id)
    && (filter === 'all' || filter === 'today' && (task.planned_date?.slice(0, 10) === today || task.due_date?.slice(0, 10) === today)
      || filter === 'overdue' && !!task.due_date && task.due_date.slice(0, 10) < today));
}
