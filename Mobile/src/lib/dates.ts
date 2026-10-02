// Deadlines store dates as local YYYY-MM-DD strings; never parse them with new Date('YYYY-MM-DD')
// (that's UTC midnight, which shows as the previous day in US timezones).

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysUntil(ymd: string, today = new Date()): number {
  const a = parseYmd(toYmd(today)).getTime();
  return Math.round((parseYmd(ymd).getTime() - a) / 86_400_000);
}

export function relativeDay(ymd: string): string {
  const n = daysUntil(ymd);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const d = parseYmd(ymd);
  if (n > 1 && n < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "23:59" or "11:59pm" -> "11:59 PM". Returns null for empty input. */
export function formatTime(t: string | null): string | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (!m) return t;
  let h = Number(m[1]);
  const min = m[2];
  const suffix = m[3]?.toLowerCase();
  if (suffix) return `${h}:${min} ${suffix.toUpperCase()}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}
