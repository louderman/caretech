/**
 * Strict exercise-streak maths, ported 1:1 from the native Android Streak.java, derived only
 * from successfully finished sessions. A fixture, a preview, an abandoned attempt and a failed
 * start are not sessions and can never credit a day.
 *
 * One credit per phone-local calendar date: several exercises finished on the same day count
 * once. A session is credited to the day it *finished* on (the stored finish instant, or the
 * start + duration a legacy record represents), so a session running past midnight lands on the
 * day it ended. Today stays open until midnight, so a streak with nothing saved today still
 * stands when yesterday was saved, and it breaks the moment a whole local day passes with
 * nothing saved. The next eligible save after a break starts the new streak at 1.
 *
 * Pure functions, no native/browser APIs beyond the standard Date object, so these can be driven
 * with explicit instants in Jest exactly like the JVM tests drove Streak.java with explicit zones.
 */

import type { Session, DayState } from './types';
import { NO_DATA, MISSED, DONE, OPEN } from './types';

/**
 * Days since 1970-01-01 on the local calendar for a wall-clock instant, via Howard Hinnant's
 * civil-from-days algorithm (so a DST transition inside the day cannot shift the day number).
 * `Date`'s getFullYear/getMonth/getDate already report in the local (or injected) timezone.
 */
function civil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * Local day number for a wall-clock instant. Without a `tz` override this uses the JS runtime's
 * configured local timezone (the device's), matching `Calendar.getInstance()` in the native code.
 * `tz` lets tests pin an explicit IANA zone the same way the JVM tests pinned a `TimeZone`.
 */
export function localDay(wallMs: number, tz?: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(new Date(wallMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return civil(get('year'), get('month'), get('day'));
}

/** Local midnight instants for the `count` days ending on nowMs's local day. */
export function dayStarts(nowMs: number, count: number, tz?: string): number[] {
  // Walk backwards one local day at a time using localDay() + a fixed-point search for midnight,
  // since there's no Calendar.set(HOUR_OF_DAY, 0) equivalent for an arbitrary IANA zone in JS.
  const out: number[] = new Array(count);
  let cursor = nowMs;
  for (let i = count - 1; i >= 0; i--) {
    cursor = midnightOf(cursor, tz);
    out[i] = cursor;
    cursor -= 1; // step into the previous local day for the next iteration
  }
  return out;
}

/** Wall-clock ms of local midnight for the local day containing `wallMs`. */
function midnightOf(wallMs: number, tz?: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(wallMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  // Timezones only ever offset by whole minutes/seconds, never by a fractional second, so the
  // millisecond-of-second is timezone-invariant: fold it in here or the candidate below lands
  // *after* local midnight by that many ms, and a 1ms decrement can never cross the day boundary.
  const msOfDay = hour * 3600000 + get('minute') * 60000 + get('second') * 1000 + (((wallMs % 1000) + 1000) % 1000);
  // Binary-search-free: subtract the local clock time, then correct for any DST jump at midnight
  // by re-deriving until the formatted local time reads 00:00.
  let candidate = wallMs - msOfDay;
  for (let i = 0; i < 4; i++) {
    const f2 = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(candidate));
    const g2 = (type: string) => Number(f2.find((p) => p.type === type)?.value);
    let h2 = g2('hour');
    if (h2 === 24) h2 = 0;
    const drift = h2 * 3600000 + g2('minute') * 60000 + g2('second') * 1000;
    if (drift === 0) break;
    candidate -= drift;
  }
  return candidate;
}

/** Distinct local day numbers with at least one finished session, ascending. */
export function doneDays(saved: Session[], tz?: string): number[] {
  const set = new Set<number>();
  for (const s of saved) set.add(localDay(s.finishWallMs, tz));
  return [...set].sort((a, b) => a - b);
}

/**
 * Strict current streak in whole local days. `doneDaysArr` must be ascending and already
 * de-duplicated (see doneDays()); `todayDay` is today's local day number.
 */
export function currentForDays(doneDaysArr: number[], todayDay: number): number {
  if (!doneDaysArr || doneDaysArr.length === 0) return 0;
  const set = new Set(doneDaysArr);
  // Today is still open: a chain ending yesterday stands until midnight.
  const anchor = set.has(todayDay) ? todayDay : todayDay - 1;
  if (!set.has(anchor)) return 0;
  let n = 0;
  while (set.has(anchor - n)) n++;
  return n;
}

export function current(saved: Session[], nowMs: number, tz?: string): number {
  return currentForDays(doneDays(saved, tz), localDay(nowMs, tz));
}

/** Per-day states for the `count` local days ending today, oldest first. */
export function states(saved: Session[], nowMs: number, tz: string | undefined, count: number): DayState[] {
  const today = localDay(nowMs, tz);
  const starts = dayStarts(nowMs, count, tz);
  const done = new Set<number>();
  let first = Infinity;
  for (const s of saved) {
    const d = localDay(s.finishWallMs, tz);
    done.add(d);
    if (d < first) first = d;
  }
  const out: DayState[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const d = localDay(starts[i], tz);
    if (done.has(d)) out[i] = DONE;
    else if (d < first) out[i] = NO_DATA; // before the very first saved session
    else if (d === today) out[i] = OPEN; // open until midnight, never a miss
    else out[i] = MISSED; // a whole local day passed with nothing saved
  }
  return out;
}

/** Latest finish instant across the saved sessions, or -1 when there are none. */
export function lastFinishMs(saved: Session[]): number {
  let best = -1;
  for (const s of saved) if (s.finishWallMs > best) best = s.finishWallMs;
  return best;
}
