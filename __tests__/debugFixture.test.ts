/** Ported from CareTechTests.java: fixtureIsLabelledAndGapped. */
import * as DebugFixture from '../src/core/debugFixture';
import * as BraceMetrics from '../src/core/braceMetrics';

describe('DebugFixture', () => {
  test('fixture declares provenance, has three sessions, third has a right-side gap', () => {
    const fx = DebugFixture.observations();
    expect(fx).toHaveLength(5);
    expect(fx[0].provenance).toBe('fixture');

    const pts = BraceMetrics.sessions(fx);
    expect(pts).toHaveLength(3);
    expect(Number.isNaN(pts[2].rightMean)).toBe(true);
    expect(Number.isNaN(pts[2].asymmetry)).toBe(true);
    expect(Number.isNaN(pts[0].asymmetry)).toBe(false);
    expect(pts[0].asymmetry).toBeGreaterThan(0);
  });
});
