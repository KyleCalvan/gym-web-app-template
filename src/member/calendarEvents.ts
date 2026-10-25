import type { Session } from '../types.ts';

/** Calendar entries come exclusively from the existing member session store. */
export function memberSessionsByDate(sessions: Session[], memberName: string | undefined): Map<string, Session[]> {
  const days = new Map<string, Session[]>();
  if (!memberName) return days;
  for (const session of sessions) {
    if (session.member !== memberName || session.status === 'Cancelled') continue;
    const date = session.date.slice(0, 10);
    days.set(date, [...(days.get(date) || []), session]);
  }
  for (const entries of days.values()) entries.sort((a, b) => a.time.localeCompare(b.time));
  return days;
}
