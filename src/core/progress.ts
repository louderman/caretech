/**
 * "Progress story" derivations for the new Home screen — recovery week count, the asymmetry
 * trend in plain language, per-exercise personal bests, and a milestones timeline. Pure
 * functions over the existing data model only (Session, SessionPoint, Streak); nothing here
 * invents data or talks to storage directly, so it is unit-testable with explicit fixtures
 * exactly like core/streak.ts.
 *
 * Direction convention: all four exercises (Sit to Stand, Timed Up and Go, Walk, Stair Climb)
 * are timed functional-mobility tests, so a LOWER duration is always the better result here
 * (faster = more mobility recovered) — not just for TUG. This mirrors how each is described in
 * core/exercises.ts (a fixed timer, not a rep counter) and the clinical tests they port
 * (5x Sit-to-Stand, TUG, a timed short walk, a timed stair climb all score "time to complete").
 */

import type { Session, SessionPoint } from './types';
import * as Streak from './streak';
import { KEYS, NAMES } from './exercises';

// ---------------------------------------------------------------------------
// Week of recovery
// ---------------------------------------------------------------------------

/** "Week N of recovery", counted from the local day of the very first saved session. Null before any session. */
export function weekOfRecovery(saved: Session[], nowMs: number, tz?: string): number | null {
  if (!saved || saved.length === 0) return null;
  let firstStart = Infinity;
  for (const s of saved) if (s.startWallMs < firstStart) firstStart = s.startWallMs;
  const firstDay = Streak.localDay(firstStart, tz);
  const today = Streak.localDay(nowMs, tz);
  const diffDays = Math.max(0, today - firstDay);
  return Math.floor(diffDays / 7) + 1;
}

// ---------------------------------------------------------------------------
// Asymmetry trend
// ---------------------------------------------------------------------------

export type TrendDirection = 'improving' | 'steady' | 'worse' | 'unavailable';

export interface AsymmetryTrend {
  /** Latest comparable asymmetry %, or null when none exists. */
  current: number | null;
  /** The comparison point — earliest comparable asymmetry % within the current local month, or
   * the very first comparable value when there is none yet this month. Null when none exists. */
  reference: number | null;
  direction: TrendDirection;
  /** Up to the 8 most recent comparable values, chronological, for a small sparkline. */
  sparkline: number[];
}

const STEADY_EPSILON_PCT = 1.0;

/** Plain-language asymmetry trend ("Left/right gap: 12% → 6% this month"). Lower is better. */
export function asymmetryTrend(points: SessionPoint[], nowMs: number, tz?: string): AsymmetryTrend {
  const comparable = (points ?? []).filter((p) => !Number.isNaN(p.asymmetry));
  if (comparable.length === 0) {
    return { current: null, reference: null, direction: 'unavailable', sparkline: [] };
  }
  const current = comparable[comparable.length - 1].asymmetry;
  const todayMonthKey = monthKey(nowMs, tz);
  const thisMonth = comparable.find((p) => monthKey(p.wallMs, tz) === todayMonthKey);
  const reference = thisMonth ? thisMonth.asymmetry : comparable[0].asymmetry;

  let direction: TrendDirection = 'steady';
  if (current < reference - STEADY_EPSILON_PCT) direction = 'improving';
  else if (current > reference + STEADY_EPSILON_PCT) direction = 'worse';

  const sparkline = comparable.slice(-8).map((p) => p.asymmetry);
  return { current, reference, direction, sparkline };
}

function monthKey(wallMs: number, tz?: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric' });
  const parts = fmt.formatToParts(new Date(wallMs));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Personal bests
// ---------------------------------------------------------------------------

export interface PersonalBest {
  key: string;
  name: string;
  hasData: boolean;
  /** Best (lowest) duration ever recorded for this exercise, ms. Null when no session yet. */
  bestMs: number | null;
  /** Wall-clock start of the session that set the current best. */
  setAtWallMs: number | null;
  /** Duration of the very first session recorded for this exercise, ms. */
  firstMs: number | null;
  /** Improvement since the first session: firstMs - bestMs (>= 0, since best can only fall). */
  changeMs: number | null;
}

/** One exercise's personal best, from its sessions in any order. */
export function personalBestFor(key: string, name: string, sessions: Session[]): PersonalBest {
  if (!sessions || sessions.length === 0) {
    return { key, name, hasData: false, bestMs: null, setAtWallMs: null, firstMs: null, changeMs: null };
  }
  const ordered = [...sessions].sort((a, b) => a.startWallMs - b.startWallMs);
  const first = ordered[0];
  let best = ordered[0];
  for (const s of ordered) if (s.durationMs < best.durationMs) best = s;
  return {
    key,
    name,
    hasData: true,
    bestMs: best.durationMs,
    setAtWallMs: best.startWallMs,
    firstMs: first.durationMs,
    changeMs: first.durationMs - best.durationMs,
  };
}

/** Personal bests for the four fixed exercises, in NAMES/KEYS order. */
export function personalBests(sessionsByKey: Record<string, Session[]>): PersonalBest[] {
  return KEYS.map((key, i) => personalBestFor(key, NAMES[i], sessionsByKey[key] ?? []));
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export type MilestoneKind = 'first-session' | 'personal-best' | 'asymmetry-gap' | 'streak';

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  label: string;
  detail: string;
  wallMs: number;
}

/** Threshold below which the asymmetry gap is called out as a milestone. */
const ASYMMETRY_GAP_THRESHOLD_PCT = 15;
/** Streak lengths (in local days) that are called out as milestones. */
const STREAK_MILESTONE_LENGTHS = [7, 14, 30];
/** Max milestones returned, most recent first. */
const MAX_MILESTONES = 6;

/** Recent achievements: first session, new PBs, an asymmetry gap crossing, streak lengths hit. */
export function milestones(
  saved: Session[],
  sessionsByKey: Record<string, Session[]>,
  points: SessionPoint[],
  tz?: string,
): Milestone[] {
  const out: Milestone[] = [];

  if (saved && saved.length > 0) {
    const first = [...saved].sort((a, b) => a.startWallMs - b.startWallMs)[0];
    out.push({
      id: 'first-session',
      kind: 'first-session',
      label: 'First session',
      detail: 'Recovery tracking started.',
      wallMs: first.startWallMs,
    });
  }

  for (const key of KEYS) {
    const name = NAMES[KEYS.indexOf(key)];
    const ordered = [...(sessionsByKey[key] ?? [])].sort((a, b) => a.startWallMs - b.startWallMs);
    let runningBest = Infinity;
    ordered.forEach((s, i) => {
      if (i > 0 && s.durationMs < runningBest) {
        out.push({
          id: `pb-${key}-${s.startWallMs}`,
          kind: 'personal-best',
          label: `New personal best: ${name}`,
          detail: formatDurationShort(s.durationMs),
          wallMs: s.startWallMs,
        });
      }
      if (s.durationMs < runningBest) runningBest = s.durationMs;
    });
  }

  const comparable = (points ?? []).filter((p) => !Number.isNaN(p.asymmetry)).sort((a, b) => a.wallMs - b.wallMs);
  for (let i = 0; i < comparable.length; i++) {
    const wasAbove = i === 0 || comparable[i - 1].asymmetry >= ASYMMETRY_GAP_THRESHOLD_PCT;
    if (wasAbove && comparable[i].asymmetry < ASYMMETRY_GAP_THRESHOLD_PCT) {
      out.push({
        id: `gap-${comparable[i].sessionId}`,
        kind: 'asymmetry-gap',
        label: `Knee gap under ${ASYMMETRY_GAP_THRESHOLD_PCT}%`,
        detail: `${comparable[i].asymmetry.toFixed(1)}% left/right difference.`,
        wallMs: comparable[i].wallMs,
      });
      break; // only the first crossing — a one-time milestone, not every dip.
    }
  }

  const days = Streak.doneDays(saved ?? [], tz);
  let runLen = 0;
  let prevDay: number | null = null;
  const hit = new Set<number>();
  for (const d of days) {
    runLen = prevDay != null && d === prevDay + 1 ? runLen + 1 : 1;
    prevDay = d;
    for (const target of STREAK_MILESTONE_LENGTHS) {
      if (runLen === target && !hit.has(target)) {
        hit.add(target);
        const wallMs = finishMsForLocalDay(saved ?? [], d, tz);
        if (wallMs != null) {
          out.push({
            id: `streak-${target}`,
            kind: 'streak',
            label: `${target}-day streak`,
            detail: `${target} days of exercises in a row.`,
            wallMs,
          });
        }
      }
    }
  }

  out.sort((a, b) => b.wallMs - a.wallMs);
  return out.slice(0, MAX_MILESTONES);
}

function finishMsForLocalDay(saved: Session[], day: number, tz?: string): number | null {
  let best: number | null = null;
  for (const s of saved) {
    if (Streak.localDay(s.finishWallMs, tz) === day && (best == null || s.finishWallMs < best)) {
      best = s.finishWallMs;
    }
  }
  return best;
}

function formatDurationShort(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
