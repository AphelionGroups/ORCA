import type { Task } from './api';

export const followUpDay = (task: Task) => task.delegated_to?.trim() ? task.follow_up_date?.slice(0, 10) || '' : '';
export const isFollowUpToday = (task: Task, today: string) => followUpDay(task) === today;

export function delegatedTasks(tasks: Task[]) {
  return tasks.filter(task => task.delegated_to?.trim() && task.status !== 'done' && task.status !== 'cancelled')
    .sort((a, b) => (followUpDay(a) || '9999-99-99').localeCompare(followUpDay(b) || '9999-99-99') || a.title.localeCompare(b.title, 'id-ID') || a.id.localeCompare(b.id));
}

export function followUpLabel(task: Task, today: string) {
  const date = followUpDay(task);
  if (!date || !Number.isFinite(Date.parse(date))) return 'Belum ada tanggal follow-up';
  if (date === today) return 'Follow-up hari ini';
  if (date < today) return `Follow-up lewat ${Math.round((Date.parse(today) - Date.parse(date)) / 86400000)} hari`;
  return `Follow-up ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: date.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))}`;
}
