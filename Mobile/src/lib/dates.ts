// Deadline dates are local "YYYY-MM-DD" strings. Mirrors Frontend/lib/deadlineGroups.ts so the app
// groups and labels deadlines exactly like the website.

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const localToday = () => toYmd(new Date());

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addDaysYmd(ymd: string, n: number): string {
  return toYmd(addDays(parseYmd(ymd), n));
}

export function daysUntil(ymd: string, today = new Date()): number {
  return Math.round((parseYmd(ymd).getTime() - parseYmd(toYmd(today)).getTime()) / 86_400_000);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "Today" / "Tomorrow" / "Tue, Oct 6" (year added when not this year). Same as the web. */
export function formatDeadlineDate(iso: string | null | undefined, today = localToday()): string {
  if (!iso || !ISO.test(iso)) return 'No date';
  if (iso === today) return 'Today';
  if (iso === addDaysYmd(today, 1)) return 'Tomorrow';
  const d = parseYmd(iso);
  const sameYear = d.getFullYear() === parseYmd(today).getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Kept for older call sites. */
export const relativeDay = (ymd: string) => formatDeadlineDate(ymd);

export function groupDeadlines<T extends { date?: string | null }>(items: T[], today = localToday()) {
  const weekEnd = addDaysYmd(today, 6);
  const earlier: T[] = [], week: T[] = [], later: T[] = [], undated: T[] = [];
  for (const it of items) {
    const d = it.date ?? '';
    if (!ISO.test(d)) undated.push(it);
    else if (d < today) earlier.push(it);
    else if (d <= weekEnd) week.push(it);
    else later.push(it);
  }
  const by = (a: T, b: T) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0);
  earlier.sort((a, b) => by(b, a));
  week.sort(by);
  later.sort(by);
  return { earlier, week, later: [...later, ...undated] };
}

/** "23:59" or "11:59pm" -> "11:59 PM". Web shows times as stored; this is for push-style labels. */
export function formatTime(t: string | null): string | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (!m) return t;
  let h = Number(m[1]);
  if (m[3]) return `${h}:${m[2]} ${m[3].toUpperCase()}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}
