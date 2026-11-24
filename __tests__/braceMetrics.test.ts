/**
 * Ported from CareTechTests.java: twoKneesAsymmetry, equalValuesZeroAsymmetry,
 * zeroDenominatorUnavailable, missingAndInvalidUnavailable, preconditionsUnavailable,
 * sessionGroupingLeavesGaps, romOnlyFromValidAngles.
 */
import * as BraceMetrics from '../src/core/braceMetrics';
import type { BraceObservation } from '../src/core/types';
import { UNIT_ADC_COUNTS, UNCALIBRATED } from '../src/core/types';

function obs(
  sessionId: string,
  side: 'L' | 'R' | '',
  calibration: string,
  raw: number[],
  unit: string = UNIT_ADC_COUNTS,
): BraceObservation {
  return {
    wallMs: 1,
    sessionId,
    sessionKey: 'walk',
    side,
    provenance: 'replay',
    unit,
    calibration,
    raw,
    angles: [],
  };
}

describe('BraceMetrics.asymmetryPercent', () => {
  test('two knee pair computes 100*|1200-1500|/1350', () => {
    const l = obs('s1', 'L', 'cal-a', [1200, 1200, 1200]);
    const r = obs('s1', 'R', 'cal-a', [1500, 1500, 1500]);
    const a = BraceMetrics.asymmetryPercent(l, r);
    expect(a).not.toBeNull();
    expect(a!).toBeCloseTo(22.2222, 3);
  });

  test('equal values compute to 0.0', () => {
    const l = obs('s1', 'L', 'cal-a', [1000, 1010]);
    const r = obs('s1', 'R', 'cal-a', [1000, 1010]);
    const a = BraceMetrics.asymmetryPercent(l, r);
    expect(a).not.toBeNull();
    expect(a!).toBeCloseTo(0.0, 9);
  });

  test('zero denominator -> unavailable, not zero', () => {
    const l = obs('s1', 'L', 'cal-a', [0, 0]);
    const r = obs('s1', 'R', 'cal-a', [0, 0]);
    expect(BraceMetrics.asymmetryPercent(l, r)).toBeNull();
    expect(BraceMetrics.asymmetryPercent(0.0, 0.0)).toBeNull();
  });

  test('missing and invalid pairs -> unavailable', () => {
    const l = obs('s1', 'L', 'cal-a', [1200]);
    expect(BraceMetrics.asymmetryPercent(l, null)).toBeNull();
    expect(BraceMetrics.asymmetryPercent(NaN, 1000.0)).toBeNull();
    expect(BraceMetrics.asymmetryPercent(1000.0, Infinity)).toBeNull();
    const noSamples = obs('s1', 'L', 'cal-a', []);
    const noSamplesR = obs('s1', 'R', 'cal-a', []);
    expect(BraceMetrics.asymmetryPercent(noSamples, noSamplesR)).toBeNull();
  });

  test('preconditions -> unavailable', () => {
    expect(BraceMetrics.asymmetryPercent(obs('s1', 'L', UNCALIBRATED, [1000]), obs('s1', 'R', UNCALIBRATED, [1000]))).toBeNull();
    expect(BraceMetrics.asymmetryPercent(obs('s1', 'L', 'cal-a', [1000]), obs('s1', 'R', 'cal-b', [1000]))).toBeNull();
    expect(
      BraceMetrics.asymmetryPercent(obs('s1', 'L', 'cal-a', [1000], 'adc_counts'), obs('s1', 'R', 'cal-a', [1000], 'volts')),
    ).toBeNull();
    expect(BraceMetrics.asymmetryPercent(obs('s1', 'L', 'cal-a', [1000]), obs('s1', 'L', 'cal-a', [1000]))).toBeNull();
    expect(BraceMetrics.asymmetryPercent(obs('s1', '', 'cal-a', [1000]), obs('s1', 'R', 'cal-a', [1000]))).toBeNull();
  });
});

describe('BraceMetrics.sessions', () => {
  test('groups by session and leaves gaps, never interpolating', () => {
    const all = [
      obs('s1', 'L', 'cal-a', [1000, 1000]),
      obs('s1', 'R', 'cal-a', [2000, 2000]),
      obs('s2', 'L', 'cal-a', [1100, 1100]), // right side incomplete
      obs('s3', 'L', 'cal-a', [900, 900]),
      obs('s3', 'R', 'cal-a', [900, 900]),
    ];
    const pts = BraceMetrics.sessions(all);
    expect(pts).toHaveLength(3);
    expect(pts[0].sessionId).toBe('s1');
    expect(pts[2].sessionId).toBe('s3');
    expect(pts[0].leftMean).toBe(1000.0);
    expect(pts[0].rightMean).toBe(2000.0);
    expect(Number.isNaN(pts[1].rightMean)).toBe(true);
    expect(Number.isNaN(pts[1].asymmetry)).toBe(true);
    expect(pts[2].asymmetry).toBe(0.0);
  });
});

describe('BraceMetrics.rom', () => {
  test('ROM is max - min of valid angles only', () => {
    const o: BraceObservation = {
      wallMs: 1,
      sessionId: 's1',
      sessionKey: 'sit_to_stand',
      side: 'L',
      provenance: 'replay',
      unit: UNIT_ADC_COUNTS,
      calibration: 'cal-a',
      raw: [100, 200],
      angles: [8.0, 41.0, 27.0, NaN],
    };
    const rom = BraceMetrics.rom(o);
    expect(rom).not.toBeNull();
    expect(Math.abs(rom! - 33.0)).toBeLessThan(1e-9);

    const none: BraceObservation = { ...o, raw: [100], angles: [] };
    expect(BraceMetrics.rom(none)).toBeNull();
    expect(BraceMetrics.rom([NaN])).toBeNull();
  });
});
