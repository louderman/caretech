import { weekOfRecovery, asymmetryTrend, personalBestFor, personalBests, milestones } from '../src/core/progress';
import type { Session, SessionPoint } from '../src/core/types';

const DAY = 86400000;
const TZ = 'UTC';

function session(startWallMs: number, durationMs: number): Session {
  return { startWallMs, durationMs, finishWallMs: startWallMs + durationMs };
}

function point(wallMs: number, asymmetry: number, sessionId = `s-${wallMs}`): SessionPoint {
  return { sessionId, wallMs, leftMean: NaN, rightMean: NaN, asymmetry, leftRom: NaN, rightRom: NaN };
}

describe('weekOfRecovery', () => {
  it('is null with no sessions', () => {
    expect(weekOfRecovery([], Date.now(), TZ)).toBeNull();
  });

  it('is week 1 on the first day', () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0);
    expect(weekOfRecovery([session(t0, 1000)], t0, TZ)).toBe(1);
  });

  it('rolls to week 2 after 7 local days', () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0);
    expect(weekOfRecovery([session(t0, 1000)], t0 + 7 * DAY, TZ)).toBe(2);
  });

  it('still week 1 on day 6', () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0);
    expect(weekOfRecovery([session(t0, 1000)], t0 + 6 * DAY, TZ)).toBe(1);
  });
});

describe('asymmetryTrend', () => {
  it('is unavailable with no comparable points', () => {
    const t = asymmetryTrend([], Date.now(), TZ);
    expect(t.direction).toBe('unavailable');
    expect(t.current).toBeNull();
  });

  it('reports improving when this month is lower than the reference', () => {
    const t0 = Date.UTC(2026, 10, 1, 0, 0, 0); // 1 Nov
    const pts = [point(t0, 12), point(t0 + DAY, 6)];
    const t = asymmetryTrend(pts, t0 + DAY, TZ);
    expect(t.current).toBe(6);
    expect(t.reference).toBe(12);
    expect(t.direction).toBe('improving');
    expect(t.sparkline).toEqual([12, 6]);
  });

  it('reports worse when the latest value rose', () => {
    const t0 = Date.UTC(2026, 10, 1, 0, 0, 0);
    const pts = [point(t0, 5), point(t0 + DAY, 11)];
    const t = asymmetryTrend(pts, t0 + DAY, TZ);
    expect(t.direction).toBe('worse');
  });

  it('reports steady within the epsilon band', () => {
    const t0 = Date.UTC(2026, 10, 1, 0, 0, 0);
    const pts = [point(t0, 10), point(t0 + DAY, 10.5)];
    const t = asymmetryTrend(pts, t0 + DAY, TZ);
    expect(t.direction).toBe('steady');
  });

  it('falls back to the first-ever value when nothing from this month', () => {
    const t0 = Date.UTC(2026, 9, 1, 0, 0, 0); // October
    const now = Date.UTC(2026, 10, 15, 0, 0, 0); // November
    const pts = [point(t0, 20)];
    const t = asymmetryTrend(pts, now, TZ);
    expect(t.reference).toBe(20);
    expect(t.current).toBe(20);
    expect(t.direction).toBe('steady');
  });
});

describe('personalBestFor', () => {
  it('has no data with zero sessions', () => {
    const pb = personalBestFor('walk', 'Walk', []);
    expect(pb.hasData).toBe(false);
  });

  it('picks the lowest duration as best, with change from the first session', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const sessions = [session(t0, 60000), session(t0 + DAY, 45000), session(t0 + 2 * DAY, 50000)];
    const pb = personalBestFor('walk', 'Walk', sessions);
    expect(pb.bestMs).toBe(45000);
    expect(pb.setAtWallMs).toBe(t0 + DAY);
    expect(pb.firstMs).toBe(60000);
    expect(pb.changeMs).toBe(15000);
  });

  it('is order-independent — unsorted input gives the same result', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const sessions = [session(t0 + 2 * DAY, 50000), session(t0, 60000), session(t0 + DAY, 45000)];
    const pb = personalBestFor('walk', 'Walk', sessions);
    expect(pb.bestMs).toBe(45000);
    expect(pb.firstMs).toBe(60000);
  });

  it('a single session is its own best with zero change', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const pb = personalBestFor('walk', 'Walk', [session(t0, 30000)]);
    expect(pb.bestMs).toBe(30000);
    expect(pb.firstMs).toBe(30000);
    expect(pb.changeMs).toBe(0);
  });
});

describe('personalBests', () => {
  it('returns all four exercises in fixed order, data-less ones included', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const pbs = personalBests({ sit_to_stand: [session(t0, 20000)] });
    expect(pbs.map((p) => p.key)).toEqual(['sit_to_stand', 'timed_up_and_go', 'walk', 'stair_climb']);
    expect(pbs[0].hasData).toBe(true);
    expect(pbs[1].hasData).toBe(false);
  });
});

describe('milestones', () => {
  it('is empty with no sessions', () => {
    expect(milestones([], {}, [])).toEqual([]);
  });

  it('includes a first-session milestone', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const saved = [session(t0, 30000)];
    const ms = milestones(saved, { walk: saved }, []);
    expect(ms.some((m) => m.kind === 'first-session')).toBe(true);
  });

  it('flags a new personal best on improvement, not on the first session', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const sessions = [session(t0, 60000), session(t0 + DAY, 45000)];
    const saved = sessions;
    const ms = milestones(saved, { walk: sessions }, []);
    const pbEvents = ms.filter((m) => m.kind === 'personal-best');
    expect(pbEvents.length).toBe(1);
    expect(pbEvents[0].wallMs).toBe(t0 + DAY);
  });

  it('flags the first asymmetry-gap crossing only once', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const saved = [session(t0, 30000)];
    const pts = [point(t0, 20), point(t0 + DAY, 10), point(t0 + 2 * DAY, 8)];
    const ms = milestones(saved, { walk: saved }, pts);
    const gapEvents = ms.filter((m) => m.kind === 'asymmetry-gap');
    expect(gapEvents.length).toBe(1);
    expect(gapEvents[0].wallMs).toBe(t0 + DAY);
  });

  it('flags a 7-day streak exactly once it is reached', () => {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0);
    const saved: Session[] = [];
    for (let i = 0; i < 7; i++) saved.push(session(t0 + i * DAY, 1000));
    const ms = milestones(saved, { walk: saved }, [], TZ);
    const streakEvents = ms.filter((m) => m.kind === 'streak');
    expect(streakEvents.length).toBe(1);
    expect(streakEvents[0].label).toBe('7-day streak');
  });

  it('caps the list and sorts most-recent first', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const sessions: Session[] = [];
    for (let i = 0; i < 10; i++) sessions.push(session(t0 + i * DAY, 60000 - i * 1000));
    const ms = milestones(sessions, { walk: sessions }, []);
    expect(ms.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < ms.length; i++) expect(ms[i - 1].wallMs).toBeGreaterThanOrEqual(ms[i].wallMs);
  });
});
