/**
 * X-axis labels for the Journal charts, ported 1:1 from the native ChartLabels.java.
 *
 * One label per recorded session: the day, e.g. "23 Nov". When more than one session falls on
 * the same day the time is appended, e.g. "23 Nov 10:13", so several sessions on one day stay
 * distinguishable instead of repeating the same tick three times.
 */

import type { SessionPoint } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function forSessions(points: SessionPoint[] | null | undefined): string[] {
  if (!points || points.length === 0) return [];
  const days = points.map((p) => day(p.wallMs));
  const seen = new Map<string, number>();
  for (const d of days) seen.set(d, (seen.get(d) ?? 0) + 1);
  return points.map((p, i) => {
    const d = days[i];
    const c = seen.get(d) ?? 0;
    return c > 1 ? `${d} ${time(p.wallMs)}` : d;
  });
}

/** Short day, e.g. "23 Nov". */
export function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Clock time, e.g. "10:13". */
export function time(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
