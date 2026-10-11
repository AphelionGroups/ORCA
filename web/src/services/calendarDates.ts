export type CalendarMode = 'Day' | 'Week' | 'Month' | 'Timeline';

const formatters = new Map<string, Intl.DateTimeFormat>();
export function zonedParts(instant: string | Date, zone: string) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    formatters.set(zone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, second: Number(parts.second) };
}
export function addDays(date: string, amount: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}
export function shiftCalendar(date: string, mode: CalendarMode, amount: number): string {
  if (mode !== 'Month') return addDays(date, amount * (mode === 'Day' ? 1 : 7));
  const instant = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  instant.setUTCMonth(instant.getUTCMonth() + amount);
  return instant.toISOString().slice(0, 10);
}
export function calendarDays(date: string, mode: CalendarMode): string[] {
  if (mode === 'Day') return [date];
  const first = mode === 'Month' ? `${date.slice(0, 7)}-01` : date;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const monday = addDays(first, -((weekday + 6) % 7));
  return Array.from({ length: mode === 'Month' ? 42 : 7 }, (_, index) => addDays(monday, index));
}
/** Convert wall time to an instant, validating DST gaps rather than shifting silently. */
export function wallTimeToInstant(date: string, time: string, zone: string): string {
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Enter a valid date and time');
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = zonedParts(new Date(guess), zone);
    const represented = Date.parse(`${parts.date}T${parts.time}:${String(parts.second).padStart(2, '0')}Z`);
    const correction = target - represented;
    if (!correction) break;
    guess += correction;
  }
  const result = zonedParts(new Date(guess), zone);
  if (result.date !== date || result.time !== time) throw new Error('This time does not exist in the selected timezone');
  return new Date(guess).toISOString();
}
export function overlapsDay(event: { start_at: string; end_at: string }, date: string, zone: string): boolean {
  return Date.parse(event.start_at) < Date.parse(wallTimeToInstant(addDays(date, 1), '00:00', zone)) && Date.parse(event.end_at) > Date.parse(wallTimeToInstant(date, '00:00', zone));
}

export function layoutDayEvents<T extends { start_at: string; end_at: string; is_all_day: boolean }>(events: T[], date: string, zone: string) {
  const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const entries = events.filter(event => !event.is_all_day && overlapsDay(event, date, zone)).map(event => {
    const start = zonedParts(event.start_at, zone), end = zonedParts(event.end_at, zone);
    return { event, start: start.date < date ? 0 : minute(start.time), end: end.date > date ? 1440 : minute(end.time), lane: 0, lanes: 1 };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof entries = [], ends: number[] = [], groupEnd = -1;
  const flush = () => { for (const entry of group) entry.lanes = ends.length; group = []; ends = []; };
  for (const entry of entries) {
    if (entry.start >= groupEnd) flush();
    let lane = ends.findIndex(end => end <= entry.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = entry.end;
    entry.lane = lane;
    group.push(entry);
    groupEnd = Math.max(groupEnd, entry.end);
  }
  flush();
  return entries;
}
