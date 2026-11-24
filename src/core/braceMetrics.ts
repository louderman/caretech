/**
 * The derived values the Journal charts show, ported 1:1 from the native BraceMetrics.java.
 *
 * Mean sensor reading is the user's own sensor signal — the mean of the retained raw samples
 * for that side, in the record's own unit (adc_counts = raw 12-bit ADC counts). It is not a
 * physiological measure, a resistance, or a force, and this build has no conversion to one.
 *
 * Knee asymmetry % is a documented *provisional* absolute symmetric percent difference:
 *
 *   100 * |L - R| / mean(L, R)
 *
 * computed only for a pair that is (a) aligned to the same recording session, (b) both
 * calibrated, (c) the same calibration identity (so the two sides are on one scale), (d) in the
 * same documented unit, and (e) both finite with a non-zero mean. Anything else yields
 * `null` — reported as unavailable, never as 0.
 */

import type { BraceObservation, SessionPoint } from './types';
import { isLeft, isRight, isCalibrated, hasKnownSide } from './types';

/** Mean of the raw samples, or NaN when there are none. */
export function meanReading(o: BraceObservation | null | undefined): number {
  if (!o || o.raw.length === 0) return NaN;
  let sum = 0;
  let n = 0;
  for (const v of o.raw) {
    if (v == null || Number.isNaN(v) || !Number.isFinite(v)) continue;
    sum += v;
    n++;
  }
  return n === 0 ? NaN : sum / n;
}

/**
 * Range of motion in degrees: max - min over the observation's *valid* calibrated angles, or
 * null (unavailable) when it holds none. Never fabricated from raw counts.
 */
export function rom(o: BraceObservation | number[] | null | undefined): number | null {
  const angles = o == null ? null : Array.isArray(o) ? o : o.angles;
  if (!angles || angles.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  for (const a of angles) {
    if (a == null || Number.isNaN(a) || !Number.isFinite(a)) continue;
    if (a < min) min = a;
    if (a > max) max = a;
    n++;
  }
  return n === 0 ? null : max - min;
}

/**
 * Provisional absolute symmetric percent difference for one aligned, calibrated, comparable
 * same-unit pair, or null when any precondition fails (checked in the documented order).
 * Zero mean -> null, never 0 or infinity.
 */
export function asymmetryPercent(
  left: BraceObservation | number | null | undefined,
  right: BraceObservation | number | null | undefined,
): number | null {
  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left) || !Number.isFinite(left) || Number.isNaN(right) || !Number.isFinite(right)) {
      return null;
    }
    const mean = (left + right) / 2.0;
    if (mean === 0.0) return null;
    return (100.0 * Math.abs(left - right)) / mean;
  }
  const l = left as BraceObservation | null | undefined;
  const r = right as BraceObservation | null | undefined;
  if (!l || !r) return null;
  if (!isLeft(l) || !isRight(r)) return null;
  if (l.unit !== r.unit || l.unit === '') return null;
  if (!isCalibrated(l) || !isCalibrated(r)) return null;
  if (l.calibration !== r.calibration) return null;
  return asymmetryPercent(meanReading(l), meanReading(r));
}

/**
 * Groups observations by recording session (aligned), then emits one point per session in
 * chronological order. Missing sides stay NaN so the chart can leave a gap instead of
 * interpolating across them.
 */
export function sessions(all: BraceObservation[]): SessionPoint[] {
  const out: SessionPoint[] = [];
  if (!all || all.length === 0) return out;
  const bySession = new Map<string, BraceObservation[]>();
  for (const o of all) {
    if (!o || !hasKnownSide(o)) continue; // Unknown side is never labelled L/R.
    const key = o.sessionId;
    let bucket = bySession.get(key);
    if (!bucket) {
      bucket = [];
      bySession.set(key, bucket);
    }
    bucket.push(o);
  }
  for (const [sessionId, bucket] of bySession) {
    const left = latestFor(bucket, true);
    const right = latestFor(bucket, false);
    let wall = Infinity;
    for (const o of bucket) if (o.wallMs < wall) wall = o.wallMs;
    const le = left ? meanReading(left) : NaN;
    const re = right ? meanReading(right) : NaN;
    const asym = asymmetryPercent(left, right);
    const lrom = left ? rom(left) : null;
    const rrom = right ? rom(right) : null;
    out.push({
      sessionId,
      wallMs: wall,
      leftMean: le,
      rightMean: re,
      asymmetry: asym == null ? NaN : asym,
      leftRom: lrom == null ? NaN : lrom,
      rightRom: rrom == null ? NaN : rrom,
    });
  }
  out.sort((a, b) => (a.wallMs !== b.wallMs ? a.wallMs - b.wallMs : a.sessionId.localeCompare(b.sessionId)));
  return out;
}

function latestFor(bucket: BraceObservation[], left: boolean): BraceObservation | null {
  let best: BraceObservation | null = null;
  for (const o of bucket) {
    const match = left ? isLeft(o) : isRight(o);
    if (!match) continue;
    if (!best || o.wallMs >= best.wallMs) best = o;
  }
  return best;
}
