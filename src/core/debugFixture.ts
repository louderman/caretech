/**
 * Synthetic recordings for *isolated debug previews only*, ported 1:1 from the native
 * DebugFixture.java.
 *
 * These objects are generated in memory and are never written to ObservationStore, so they can
 * never appear in the production Journal, in the saved-session history, or on a first launch.
 * The Journal shows a "Debug preview — synthetic fixture" banner whenever they are in use. They
 * exist so the two sensor-reading series and the asymmetry line can be seen and verified without
 * a real brace (no real brace data exists or may be invented).
 */

import type { BraceObservation } from './types';
import { SIDE_LEFT, SIDE_RIGHT, UNIT_ADC_COUNTS } from './types';

export const CAL = 'fixture-cal';

function obs(wallMs: number, sessionId: string, key: string, side: 'L' | 'R', raw: number[]): BraceObservation {
  return {
    wallMs,
    sessionId,
    sessionKey: key,
    side,
    provenance: 'fixture',
    unit: UNIT_ADC_COUNTS,
    calibration: CAL,
    raw,
    angles: [8.0, 41.0, 27.0],
  };
}

/** Three aligned sessions across two knees, with the third missing the right side. */
export function observations(): BraceObservation[] {
  const out: BraceObservation[] = [];
  const day = 86400000;
  const t0 = 1795000000000;

  // Session 1 — both knees present and comparable.
  out.push(obs(t0, 'ft-a', 'sit_to_stand', SIDE_LEFT, [1200, 1210, 1195, 1188]));
  out.push(obs(t0, 'ft-a', 'sit_to_stand', SIDE_RIGHT, [1500, 1490, 1512, 1505]));
  // Session 2 — both knees present, asymmetries differ.
  out.push(obs(t0 + day, 'ft-b', 'walk', SIDE_LEFT, [1300, 1290, 1310]));
  out.push(obs(t0 + day, 'ft-b', 'walk', SIDE_RIGHT, [1310, 1320, 1305]));
  // Session 3 — right side incomplete: left only, so the right series and asymmetry must show a
  // gap rather than an interpolated value.
  out.push(obs(t0 + 2 * day, 'ft-c', 'stair_climb', SIDE_LEFT, [1250, 1265]));
  return out;
}
