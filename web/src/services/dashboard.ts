import { delegatedTasks, isFollowUpToday } from './delegation.ts';
import type { Task, CalendarEvent } from './api';
import { overlapsDay } from './calendarDates.ts';

export const widgetCatalog = [
  { id: 'daily', title: 'Daily tasks', description: 'Planned, due, scheduled, or follow-up today.' },
  { id: 'unscheduled', title: 'Unscheduled tasks', description: 'Open tasks without a date or calendar session.' },
  { id: 'delegated', title: 'Didelegasikan ke orang lain', description: 'Task yang didelegasikan, diurutkan berdasarkan follow-up.' },
  { id: 'agenda', title: 'Today’s schedule', description: 'Calendar sessions for today.' },
  { id: 'projects', title: 'Projects', description: 'Quick access to your projects.' },
] as const;
export type WidgetID = typeof widgetCatalog[number]['id'];
export const widgetWidths = [4, 6, 8, 12] as const;
export const widgetHeights = [240, 360, 480] as const;
export interface WidgetLayout { id: WidgetID; columns: typeof widgetWidths[number]; height: typeof widgetHeights[number] }
export const defaultWidget = (id: WidgetID): WidgetLayout => ({ id, columns: 6, height: 360 });
export const defaultLayout = (): WidgetLayout[] => [defaultWidget('daily'), defaultWidget('unscheduled')];
export function snapWidgetSize(columns: number, height: number): Pick<WidgetLayout, 'columns' | 'height'> {
  const nearest = <T extends number>(values: readonly T[], value: number): T => values.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best);
  return { columns: nearest(widgetWidths, columns), height: nearest(widgetHeights, height) };
}
export function parseLayout(raw: string | null): WidgetLayout[] {
  if (!raw) return defaultLayout();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return defaultLayout();
    const seen = new Set<string>();
    return value.filter((item) => {
      if (!item || typeof item !== 'object' || !widgetCatalog.some(widget => widget.id === item.id) || seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).map(item => ({ id: item.id, ...snapWidgetSize(typeof item.columns === 'number' && Number.isFinite(item.columns) ? item.columns : item.wide === true ? 12 : 6, typeof item.height === 'number' && Number.isFinite(item.height) ? item.height : 360) }));
  } catch { return defaultLayout(); }
}
export function dashboardTasks(tasks: Task[], events: CalendarEvent[], today: string, zone: string) {
  const open = tasks.filter(task => task.status !== 'done' && task.status !== 'cancelled');
  const linked = new Set(events.map(event => event.linked_task_id).filter(Boolean));
  const todayLinked = new Set(events.filter(event => overlapsDay(event, today, zone)).map(event => event.linked_task_id).filter(Boolean));
  return {
    daily: open.filter(task => task.planned_date?.slice(0, 10) === today || task.due_date?.slice(0, 10) === today || todayLinked.has(task.id) || isFollowUpToday(task, today)),
    delegated: delegatedTasks(open),
    unscheduled: open.filter(task => !task.planned_date && !task.due_date && !linked.has(task.id)),
  };
}
