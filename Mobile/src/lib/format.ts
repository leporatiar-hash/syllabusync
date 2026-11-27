// Display helpers shared by Today, Calendar and course pages.

const END_SUFFIX = /\s*[-–]\s*(due|due date|availability ends|end date|closes)\s*$/i;
const OPEN_SUFFIX = /\s*[-–]\s*(available|availability starts|start date|opens)\s*$/i;

/** LMS feeds name events "Homework 3 - Due" / "Quiz 2 - Availability Ends". The server strips these
 *  now; this covers rows saved before that (e.g. from a connection that stopped syncing). */
export function cleanTitle(title: string | null | undefined): string {
  const t = (title ?? '').trim();
  if (!t) return 'Untitled';
  if (END_SUFFIX.test(t)) return t.replace(END_SUFFIX, '').trim() || t;
  if (OPEN_SUFFIX.test(t)) return `${t.replace(OPEN_SUFFIX, '').trim() || t} (opens)`;
  return t;
}

/** Only types worth calling out next to a title; "Assignment" on every row is noise. */
export function notableType(type: string | null | undefined, title?: string | null): 'Exam' | 'Quiz' | 'Project' | null {
  const t = (type ?? '').toLowerCase();
  if (t === 'exam') return 'Exam';
  if (t === 'quiz') return 'Quiz';
  if (t === 'project') return 'Project';
  const name = (title ?? '').toLowerCase();
  if (/\b(final exam|midterm|exam)\b/.test(name)) return 'Exam';
  if (/\bquiz\b/.test(name)) return 'Quiz';
  return null;
}

export const TYPE_TAG: Record<'Exam' | 'Quiz' | 'Project', { fg: string; bg: string }> = {
  Exam: { fg: '#B91C1C', bg: '#FEE2E2' },
  Quiz: { fg: '#C2410C', bg: '#FFEDD5' },
  Project: { fg: '#7C3AED', bg: '#EDE9FE' },
};

/** "in 3 days" / "tomorrow" / "today" for a YYYY-MM-DD relative to today. */
export function relativeDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
