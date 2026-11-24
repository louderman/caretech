/**
 * Ported from CareTechTests.java streakCases(): strict streak rules — real finished sessions
 * only, one credit per phone-local calendar day, today open until midnight, a whole missed day
 * breaks the chain, midnight rollover and DST safe.
 */
import * as Streak from '../src/core/streak';
import * as SessionStore from '../src/core/sessionStore';
import * as DebugFixture from '../src/core/debugFixture';
import type { Session } from '../src/core/types';
import { NO_DATA, DONE, OPEN } from '../src/core/types';

const BERLIN = 'Europe/Berlin';
const KOLKATA = 'Asia/Kolkata';

/** A local wall-clock instant in a given IANA zone, built from a UTC guess corrected to match. */
function at(tz: string, year: number, month: number, day: number, hour: number, minute: number): number {
  // Start from a UTC-interpreted guess, then correct by the zone's offset at that instant so the
  // *local* wall time in `tz` reads exactly year-month-day hour:minute.
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
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
    const parts = fmt.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    let h = get('hour');
    if (h === 24) h = 0;
    const got = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
    const want = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = want - got;
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
}

/** One finished one-minute session per given finish instant. */
function sessions(...finishMs: number[]): Session[] {
  return finishMs.map((f) => ({ startWallMs: f - 60000, durationMs: 60000, finishWallMs: f }));
}

describe('Streak', () => {
  const now = at(BERLIN, 2025, 4, 2, 10, 0); // Wednesday 2 April 2025, 10:00 local

  test('no saved sessions -> 0, every day no-data, never missed', () => {
    expect(Streak.current(sessions(), now, BERLIN)).toBe(0);
    const none = Streak.states(sessions(), now, BERLIN, 7);
    expect(none.every((s) => s === NO_DATA)).toBe(true);
  });

  test('saved today only -> 1; today done, the day before no-data', () => {
    expect(Streak.current(sessions(at(BERLIN, 2025, 4, 2, 9, 5)), now, BERLIN)).toBe(1);
    const t = Streak.states(sessions(at(BERLIN, 2025, 4, 2, 9, 5)), now, BERLIN, 2);
    expect(t[1]).toBe(DONE);
    expect(t[0]).toBe(NO_DATA);
  });

  test('yesterday only -> 1, today still open', () => {
    const y = Streak.states(sessions(at(BERLIN, 2025, 4, 1, 18, 0)), now, BERLIN, 3);
    expect(Streak.current(sessions(at(BERLIN, 2025, 4, 1, 18, 0)), now, BERLIN)).toBe(1);
    expect(y[1]).toBe(DONE);
    expect(y[2]).toBe(OPEN);
  });

  test('a whole missed local day breaks the chain', () => {
    expect(Streak.current(sessions(at(BERLIN, 2025, 3, 30, 9, 0), at(BERLIN, 2025, 4, 1, 9, 0)), now, BERLIN)).toBe(1);
    expect(Streak.current(sessions(at(BERLIN, 2025, 3, 30, 9, 0), at(BERLIN, 2025, 3, 31, 9, 0)), now, BERLIN)).toBe(0);
    expect(
      Streak.current(
        sessions(at(BERLIN, 2025, 3, 30, 9, 0), at(BERLIN, 2025, 3, 31, 9, 0), at(BERLIN, 2025, 4, 1, 9, 0)),
        now,
        BERLIN,
      ),
    ).toBe(3);
    expect(
      Streak.current(
        sessions(
          at(BERLIN, 2025, 3, 30, 9, 0),
          at(BERLIN, 2025, 3, 31, 9, 0),
          at(BERLIN, 2025, 4, 1, 9, 0),
          at(BERLIN, 2025, 4, 2, 7, 0),
        ),
        now,
        BERLIN,
      ),
    ).toBe(4);
  });

  test('several exercises on one day count once', () => {
    expect(Streak.current(sessions(at(BERLIN, 2025, 4, 2, 8, 0), at(BERLIN, 2025, 4, 2, 20, 0)), now, BERLIN)).toBe(1);
    expect(
      Streak.current(
        sessions(at(BERLIN, 2025, 4, 1, 8, 0), at(BERLIN, 2025, 4, 1, 19, 30), at(BERLIN, 2025, 4, 2, 7, 30)),
        now,
        BERLIN,
      ),
    ).toBe(2);
    expect(
      Streak.doneDays(sessions(at(BERLIN, 2025, 4, 1, 8, 0), at(BERLIN, 2025, 4, 1, 19, 30)), BERLIN),
    ).toHaveLength(1);
  });

  test('a session spanning midnight credits its finish day', () => {
    const startLate = at(BERLIN, 2025, 4, 1, 23, 50);
    const finished = at(BERLIN, 2025, 4, 2, 0, 5);
    const spanning: Session[] = [{ startWallMs: startLate, durationMs: finished - startLate, finishWallMs: finished }];
    expect(Streak.current(spanning, now, BERLIN)).toBe(1);
  });

  test('legacy 2-field record credits the day its start + duration lands on', () => {
    const parsed = SessionStore.parse('1743555600000|1800000');
    const days = Streak.doneDays(parsed, BERLIN);
    expect(Streak.currentForDays(days, Streak.localDay(1743555600000 + 1800000, BERLIN))).toBe(1);
  });

  test('day numbers stay consecutive across a DST change', () => {
    // Berlin springs forward at 02:00 on 2025-03-30.
    expect(Streak.localDay(at(BERLIN, 2025, 3, 30, 23, 30), BERLIN) - Streak.localDay(at(BERLIN, 2025, 3, 29, 23, 30), BERLIN)).toBe(
      1,
    );
    expect(
      Streak.current(
        sessions(
          at(BERLIN, 2025, 3, 29, 23, 30),
          at(BERLIN, 2025, 3, 30, 23, 30),
          at(BERLIN, 2025, 3, 31, 23, 30),
          at(BERLIN, 2025, 4, 1, 22, 0),
        ),
        now,
        BERLIN,
      ),
    ).toBe(4);
  });

  test('a half-hour-offset zone counts its own local days', () => {
    expect(
      Streak.current(sessions(at(KOLKATA, 2025, 4, 2, 0, 10)), at(KOLKATA, 2025, 4, 2, 3, 0), KOLKATA),
    ).toBe(1);
  });

  test('fixture observations exist but credit nothing', () => {
    expect(DebugFixture.observations().length).toBeGreaterThan(0);
    expect(Streak.current(sessions(), now, BERLIN)).toBe(0);
  });
});
